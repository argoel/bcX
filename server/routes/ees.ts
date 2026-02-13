/**
 * Enterprise Event System (EES) Routes
 *
 * Handles incoming PUSH events from EES and manages subscriptions.
 *
 *   POST /api/ees/events          → Receive EES PUSH events (EESEventAdd)
 *   POST /api/ees/subscribe       → Create ACH event subscription
 *   GET  /api/ees/subscriptions   → List active subscriptions
 *   GET  /api/ees/log             → View event log
 *   POST /api/ees/pull            → Pull events (for PULL delivery)
 *
 * Docs: https://jackhenry.dev/open-enterprise-api-docs/enterprise-event-system/overview/
 */

import { Router, type Request, type Response } from "express";
import { EES } from "../config/jackhenry";
import { EESService } from "../services/ees";

const router = Router();

/**
 * POST /api/ees/events
 *
 * EES PUSH event receiver endpoint.
 *
 * This is the endpoint EES delivers events to. Per JH requirements:
 *   - SOAP Action header is always: http://jackhenry.com/ws/EESEventAdd
 *   - We must authenticate, respond with XML, and close the connection
 *   - Event processing happens AFTER the connection closes
 *
 * The Content-Type is text/xml (SOAP), not JSON.
 */
router.post("/events", async (req: Request, res: Response) => {
  // Verify the SOAP action header
  const soapAction = req.headers.soapaction || req.headers["SOAPAction"];
  if (soapAction && soapAction !== EES.pushAction) {
    return res.status(400).send("Invalid SOAP Action");
  }

  try {
    // Parse the raw SOAP XML body
    const soapXml = typeof req.body === "string"
      ? req.body
      : req.body.toString("utf-8");

    // Process the event and get the acknowledgment response
    const { responseXml, event } = await EESService.handlePushEvent(soapXml);

    // Respond with the SOAP acknowledgment XML
    // (processing continues asynchronously after this response)
    res.set("Content-Type", "text/xml; charset=utf-8");
    res.send(responseXml);

    console.log(
      `[EES] Event ${event.eventId} received: ${event.payload.eventAction}` +
      (event.payload.xferKey ? ` (XferKey: ${event.payload.xferKey})` : "")
    );
  } catch (err) {
    console.error("[EES] Error processing push event:", err);
    // Even on error, try to respond properly per JH requirements
    res.status(500).set("Content-Type", "text/xml; charset=utf-8").send(
      `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <soap:Fault>
      <faultcode>soap:Server</faultcode>
      <faultstring>Internal processing error</faultstring>
    </soap:Fault>
  </soap:Body>
</soap:Envelope>`
    );
  }
});

/**
 * POST /api/ees/subscribe
 *
 * Create an ACH event subscription.
 * Subscribes to events: 840, 850, 860, 910
 */
router.post("/subscribe", (_req: Request, res: Response) => {
  const subscription = EESService.createACHSubscription();

  res.status(201).json({
    subscription,
    message: "Subscribed to ACH events. Events will be pushed to the configured endpoint.",
    subscribedEvents: {
      840: "ACH Transaction Created",
      850: "ACH Return/Rejection",
      860: "ACH Settlement Completed",
      910: "ACH Notification of Change",
    },
  });
});

/**
 * GET /api/ees/subscriptions
 *
 * List all active EES subscriptions.
 */
router.get("/subscriptions", (_req: Request, res: Response) => {
  res.json({ subscriptions: EESService.getSubscriptions() });
});

/**
 * GET /api/ees/log
 *
 * View the event log (for debugging / monitoring).
 */
router.get("/log", (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const events = EESService.getEventLog().slice(-limit);
  res.json({ events, total: EESService.getEventLog().length });
});

/**
 * POST /api/ees/pull
 *
 * Pull events from EES (for PULL delivery subscriptions).
 */
router.post("/pull", async (req: Request, res: Response) => {
  const { subscriptionId, maxEvents } = req.body;

  if (!subscriptionId) {
    return res.status(400).json({ error: "subscriptionId is required" });
  }

  try {
    const events = await EESService.pullEvents({
      subscriptionId,
      maxEvents,
    });
    res.json({ events, count: events.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Pull failed";
    res.status(500).json({ error: message });
  }
});

export default router;
