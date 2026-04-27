/**
 * Enterprise Event System (EES) Service
 *
 * Pub/Sub middleware for banking events using SOAP protocol.
 * Supports both PUSH (events delivered to our endpoint) and
 * PULL (we query EES for events via EESEventSrch).
 *
 * ACH Event Flow:
 *   840 → ACH Transaction Created
 *   860 → ACH Settlement Completed
 *   850 → ACH Return/Rejection
 *   910 → ACH Notification of Change (NOC)
 *
 * PUSH subscribers receive EESEventAdd SOAP messages at their endpoint.
 * SOAP Action is always: http://jackhenry.com/ws/EESEventAdd
 *
 * Docs: https://jackhenry.dev/open-enterprise-api-docs/enterprise-event-system/overview/
 *       https://jackhenry.dev/ees/faq/
 */

import { EES, ACH_RETURN_CODES, type ACHReturnCode } from "../config/jackhenry";
import { JXchangeService } from "./jxchange";
import type {
  EESEvent,
  EESEventPayload,
  EESSubscription,
  ACHWorkflowEvent,
  ACHWorkflowStep,
  ACHTransactionStatus,
  ACHScenario,
} from "../types";

// ── In-memory stores ─────────────────────────────────────────────────

const subscriptions = new Map<string, EESSubscription>();
const achWorkflows = new Map<string, ACHWorkflowEvent>();
const eventLog: EESEvent[] = [];

// Event handlers registered by the application
type EventHandler = (event: EESEvent) => void | Promise<void>;
const eventHandlers: EventHandler[] = [];

// ── EES Service ──────────────────────────────────────────────────────

export const EESService = {
  /**
   * Subscribe to ACH-related events via EES.
   *
   * For PUSH delivery, EES will send EESEventAdd SOAP messages
   * to our subscriber endpoint. The subscription is configured
   * through the EES Subscription Form and JH back-office.
   *
   * Event IDs we subscribe to:
   *   840 - ACH Transaction Created
   *   850 - ACH Return/Rejection
   *   860 - ACH Settlement Completed
   *   910 - ACH NOC Received
   */
  createACHSubscription(): EESSubscription {
    const subscription: EESSubscription = {
      subscriptionId: `sub-ach-${Date.now()}`,
      eventIds: [
        EES.events.achTransactionCreated,
        EES.events.achReturn,
        EES.events.achSettlement,
        EES.events.achNotificationOfChange,
      ],
      deliveryMethod: "push",
      endpoint: EES.subscriberEndpoint,
      status: "active",
      createdAt: new Date().toISOString(),
    };

    subscriptions.set(subscription.subscriptionId, subscription);
    return subscription;
  },

  /**
   * Register an event handler to be called when events arrive.
   */
  onEvent(handler: EventHandler): void {
    eventHandlers.push(handler);
  },

  /**
   * Handle an incoming EES PUSH event (EESEventAdd SOAP message).
   *
   * Per JH docs, PUSH subscribers must:
   *   1. Authenticate the incoming request
   *   2. Respond with appropriate XML
   *   3. Close the connection
   *   4. Process the payload AFTER closing the connection
   *
   * The Security.TimeStamp.Created and Expires should be 5 min apart (UTC).
   */
  async handlePushEvent(soapXml: string): Promise<{
    responseXml: string;
    event: EESEvent;
  }> {
    // Parse the EESEventAdd SOAP message
    const event = this.parseEESEvent(soapXml);

    // Log the event
    eventLog.push(event);

    // Build the acknowledgment response XML
    // (must echo the JESHdr fields from the request)
    const responseXml = this.buildPushResponse(soapXml);

    // Process the event asynchronously (after connection closes)
    setImmediate(async () => {
      await this.processEvent(event);
    });

    return { responseXml, event };
  },

  /**
   * Parse an EESEventAdd SOAP message into our EESEvent structure.
   */
  parseEESEvent(soapXml: string): EESEvent {
    const eventId = parseInt(extractElement(soapXml, "EventId") || "0", 10);
    const eventType = extractElement(soapXml, "EventType") || "";
    const eventTimestamp = extractElement(soapXml, "EventDt") || new Date().toISOString();
    const instRtId = extractElement(soapXml, "InstRtId") || "";

    // Extract event-specific payload fields
    const payload: EESEventPayload = {
      eventCategory: extractElement(soapXml, "EventCat") || mapEventCategory(eventId),
      eventAction: extractElement(soapXml, "EventAction") || mapEventAction(eventId),
      xferKey: extractElement(soapXml, "XferKey") || undefined,
      traceNumber: extractElement(soapXml, "TraceNbr") || undefined,
      amount: parseFloat(extractElement(soapXml, "Amt") || "0") || undefined,
      fromAccountId: extractElement(soapXml, "AcctIdFrom") || extractElement(soapXml, "AcctId") || undefined,
      toAccountId: extractElement(soapXml, "AcctIdTo") || undefined,
      toRoutingNumber: extractElement(soapXml, "ACHRtNbr") || undefined,
      achReturnCode: extractElement(soapXml, "ACHRetCd") || undefined,
      achReturnReason: extractElement(soapXml, "ACHRetDesc") || undefined,
      settlementDate: extractElement(soapXml, "SettlDt") || undefined,
      effectiveDate: extractElement(soapXml, "EffDt") || undefined,
      status: mapEventIdToStatus(eventId, extractElement(soapXml, "ACHRetCd") || undefined),
    };

    return {
      eventId,
      eventType,
      eventTimestamp,
      institutionRoutingId: instRtId,
      payload,
    };
  },

  /**
   * Build the SOAP response for an EES PUSH event.
   *
   * Per JH requirements: echo the JESHdr fields, set Created/Expires
   * timestamps 5 minutes apart in UTC.
   */
  buildPushResponse(requestXml: string): string {
    const now = new Date();
    const expires = new Date(now.getTime() + 5 * 60 * 1000);

    // Echo the tracking ID from the request
    const trackingId = extractElement(requestXml, "jXLogTrackingId") || "";

    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Header>
    <wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
      <wsu:Timestamp xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
        <wsu:Created>${now.toISOString()}</wsu:Created>
        <wsu:Expires>${expires.toISOString()}</wsu:Expires>
      </wsu:Timestamp>
    </wsse:Security>
  </soap:Header>
  <soap:Body>
    <EESEventAddResponse xmlns="${EES.pushAction}">
      <JESHdr>
        <jXLogTrackingId>${trackingId}</jXLogTrackingId>
      </JESHdr>
      <RsStat>Success</RsStat>
    </EESEventAddResponse>
  </soap:Body>
</soap:Envelope>`;
  },

  /**
   * Process an event — update ACH workflow tracking and notify handlers.
   *
   * This is where we handle all three ACH scenarios:
   *
   * Scenario 1: Accepted → Settled (happy path)
   *   Event 840 (created) → Event 860 (settled)
   *
   * Scenario 2: Accepted → Rejected by ACH network
   *   Event 840 (created) → Event 850 (return with R05/R06/R11/R13 codes)
   *
   * Scenario 3: Accepted → Rejected by receiver bank (RDFI)
   *   Event 840 (created) → Event 850 (return with R01-R04/R07-R10 codes)
   */
  async processEvent(event: EESEvent): Promise<void> {
    const { payload } = event;

    // If this event has a XferKey, update the workflow
    if (payload.xferKey) {
      await this.updateACHWorkflow(payload.xferKey, event);
    }

    // Notify all registered handlers
    for (const handler of eventHandlers) {
      try {
        await handler(event);
      } catch (err) {
        console.error("Event handler error:", err);
      }
    }
  },

  /**
   * Update the ACH workflow for a transfer based on an incoming event.
   * Tracks the full lifecycle and determines the scenario.
   */
  async updateACHWorkflow(
    xferKey: string,
    event: EESEvent
  ): Promise<ACHWorkflowEvent> {
    let workflow = achWorkflows.get(xferKey);

    if (!workflow) {
      workflow = {
        id: `wf-${Date.now()}`,
        xferKey,
        scenario: "in_progress",
        events: [],
        currentStatus: "pending",
        createdAt: new Date().toISOString(),
      };
      achWorkflows.set(xferKey, workflow);
    }

    const step: ACHWorkflowStep = {
      step: workflow.events.length + 1,
      action: event.payload.eventAction,
      status: event.payload.status || "pending",
      timestamp: event.eventTimestamp,
      details: {
        eventId: event.eventId,
        returnCode: event.payload.achReturnCode,
        returnReason: event.payload.achReturnReason,
        settlementDate: event.payload.settlementDate,
      },
    };

    workflow.events.push(step);
    workflow.currentStatus = step.status;

    // Determine the scenario based on event progression
    switch (event.eventId) {
      case EES.events.achTransactionCreated:
        // ACH transfer initiated — still in progress
        workflow.currentStatus = "submitted";
        break;

      case EES.events.achSettlement:
        // Scenario 1: Accepted and settled (happy path)
        workflow.scenario = "accepted_and_settled";
        workflow.currentStatus = "settled";
        workflow.completedAt = event.eventTimestamp;
        break;

      case EES.events.achReturn: {
        // Determine if rejected by network or receiver bank
        const returnCode = event.payload.achReturnCode;
        if (returnCode && returnCode in ACH_RETURN_CODES) {
          const codeInfo = ACH_RETURN_CODES[returnCode as ACHReturnCode];
          if (codeInfo.category === "rejected_by_network") {
            // Scenario 2: Rejected by ACH network
            workflow.scenario = "accepted_rejected_by_network";
          } else {
            // Scenario 3: Rejected by receiver bank (RDFI)
            workflow.scenario = "rejected_by_receiver";
          }
        } else {
          // Default to network rejection if we can't classify
          workflow.scenario = "accepted_rejected_by_network";
        }
        workflow.currentStatus = "returned";
        workflow.completedAt = event.eventTimestamp;
        break;
      }

      case EES.events.achNotificationOfChange:
        // NOC received — informational, doesn't change the scenario
        workflow.currentStatus = "noc_received";
        break;
    }

    // Enrich with latest transfer details from jXchange
    try {
      const transferDetails = await JXchangeService.getTransferByKey(xferKey);
      if (transferDetails) {
        step.details = {
          ...step.details,
          transferStatus: transferDetails.status,
          achDetails: transferDetails.achDetails,
        };
      }
    } catch {
      // Non-fatal — the event data is sufficient
    }

    achWorkflows.set(xferKey, workflow);
    return workflow;
  },

  // ── Pull delivery: query EES for events ────────────────────────────

  /**
   * Pull events from EES using EESEventSrch.
   * Used when the subscriber is configured for PULL delivery.
   */
  async pullEvents(params: {
    subscriptionId: string;
    maxEvents?: number;
  }): Promise<EESEvent[]> {
    // Build EESEventSrch SOAP request
    const soapBody = `
    <EESEventSrch xmlns="${EES.pushAction}">
      <EESEventSrchRq>
        <SubId>${params.subscriptionId}</SubId>
        <MaxRec>${params.maxEvents || 100}</MaxRec>
      </EESEventSrchRq>
    </EESEventSrch>`;

    const response = await fetch(EES.serviceUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "http://jackhenry.com/ws/EESEventSrch",
      },
      body: `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>${soapBody}</soap:Body>
</soap:Envelope>`,
    });

    if (!response.ok) {
      throw new Error(`EES pull failed: ${response.status}`);
    }

    const xml = await response.text();
    // Parse multiple events from the response
    const events: EESEvent[] = [];
    const eventBlocks = xml.match(/<EESEvent[^>]*>[\s\S]*?<\/EESEvent>/gi) || [];
    for (const block of eventBlocks) {
      events.push(this.parseEESEvent(block));
    }

    return events;
  },

  // ── Workflow query methods ─────────────────────────────────────────

  /**
   * Get the full workflow for an ACH transfer.
   */
  getWorkflow(xferKey: string): ACHWorkflowEvent | undefined {
    return achWorkflows.get(xferKey);
  },

  /**
   * Get all workflows, optionally filtered by scenario.
   */
  getAllWorkflows(scenario?: ACHScenario): ACHWorkflowEvent[] {
    const all = Array.from(achWorkflows.values());
    if (scenario) {
      return all.filter((w) => w.scenario === scenario);
    }
    return all;
  },

  /**
   * Get all subscriptions.
   */
  getSubscriptions(): EESSubscription[] {
    return Array.from(subscriptions.values());
  },

  /**
   * Get the event log.
   */
  getEventLog(): EESEvent[] {
    return eventLog;
  },

  /**
   * Start an ACH workflow — called after XferAdd succeeds.
   * Creates the initial workflow entry to track through to completion.
   */
  startWorkflow(xferKey: string, transferDetails: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
  }): ACHWorkflowEvent {
    const workflow: ACHWorkflowEvent = {
      id: `wf-${Date.now()}`,
      xferKey,
      scenario: "in_progress",
      events: [{
        step: 1,
        action: "ACH Transfer Initiated (XferAdd)",
        status: "pending",
        timestamp: new Date().toISOString(),
        details: transferDetails,
      }],
      currentStatus: "pending",
      createdAt: new Date().toISOString(),
    };

    achWorkflows.set(xferKey, workflow);
    return workflow;
  },
};

// ── Helpers ──────────────────────────────────────────────────────────

function extractElement(xml: string, tag: string): string | null {
  const regex = new RegExp(`<(?:[^:]+:)?${tag}[^>]*>([^<]*)</(?:[^:]+:)?${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

function mapEventCategory(eventId: number): string {
  switch (eventId) {
    case EES.events.achTransactionCreated: return "ACH.Transaction";
    case EES.events.achReturn: return "ACH.Return";
    case EES.events.achSettlement: return "ACH.Settlement";
    case EES.events.achNotificationOfChange: return "ACH.NOC";
    default: return "Unknown";
  }
}

function mapEventAction(eventId: number): string {
  switch (eventId) {
    case EES.events.achTransactionCreated: return "Created";
    case EES.events.achReturn: return "Returned";
    case EES.events.achSettlement: return "Settled";
    case EES.events.achNotificationOfChange: return "NOC Received";
    default: return "Unknown";
  }
}

function mapEventIdToStatus(eventId: number, returnCode?: string): ACHTransactionStatus {
  if (returnCode) return "returned";
  switch (eventId) {
    case EES.events.achTransactionCreated: return "submitted";
    case EES.events.achReturn: return "returned";
    case EES.events.achSettlement: return "settled";
    case EES.events.achNotificationOfChange: return "noc_received";
    default: return "pending";
  }
}
