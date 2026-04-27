/**
 * jXchange SOAP API Service
 *
 * Implements ACH bank-to-bank transfers via jXchange:
 *   - XferAdd: Initiate ACH transfers with ACHXferRec_CType
 *   - XferSrch: Search/retrieve transfer details by XferKey
 *
 * SOAP namespace: http://jackhenry.com/jxchange/TPG/2008
 *
 * Docs: https://jackhenry.dev/jxchange-soap/api-reference/core-services/xferadd/
 *       https://jackhenry.dev/jxchange-soap/api-reference/core-services/xfersrch/
 */

import { JXCHANGE } from "../config/jackhenry";
import type {
  ACHTransferRequest,
  ACHTransferResponse,
  XferSearchResult,
  ACHTransactionStatus,
} from "../types";

// ── OAuth Token Cache for jXchange ───────────────────────────────────

let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Obtain an OAuth 2.0 bearer token for jXchange API calls.
 * JH is transitioning all jXchange auth to OAuth 2.0.
 */
async function getJXchangeToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.token;
  }

  const response = await fetch(JXCHANGE.oauth.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: JXCHANGE.oauth.clientId,
      client_secret: JXCHANGE.oauth.clientSecret,
      scope: JXCHANGE.oauth.scope,
    }),
  });

  if (!response.ok) {
    throw new Error(`jXchange OAuth failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return cachedToken.token;
}

// ── SOAP Envelope Builders ───────────────────────────────────────────

const NS = JXCHANGE.namespace;

/**
 * Build the standard jXchange SOAP header (jXchangeHdr).
 * Required in all jXchange requests.
 */
function buildJXchangeHeader(trackingId: string): string {
  return `
    <jXchangeHdr xmlns="${NS}">
      <JxVer>2008</JxVer>
      <AuditUsrId>SYSTEM</AuditUsrId>
      <AuditWsId>FINANCEHUB</AuditWsId>
      <InstRtId>${JXCHANGE.institution.routingId}</InstRtId>
      <InstEnv>${JXCHANGE.institution.environment}</InstEnv>
      <jXLogTrackingId>${trackingId}</jXLogTrackingId>
      <ValidConsmName>${JXCHANGE.institution.consumerName}</ValidConsmName>
      <ValidConsmProd>${JXCHANGE.institution.consumerProduct}</ValidConsmProd>
    </jXchangeHdr>`;
}

/**
 * Wrap content in a SOAP envelope with WS-Security OAuth token.
 */
function wrapSoapEnvelope(action: string, body: string, token: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope
  xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:tpg="${NS}"
  xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
  <soap:Header>
    <wsse:Security>
      <wsse:BinarySecurityToken
        ValueType="urn:ietf:params:oauth:token-type:jwt"
        EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">
        ${token}
      </wsse:BinarySecurityToken>
    </wsse:Security>
  </soap:Header>
  <soap:Body>
    ${body}
  </soap:Body>
</soap:Envelope>`;
}

/**
 * Send a SOAP request to jXchange and parse the response.
 */
async function sendSoapRequest(action: string, soapXml: string): Promise<string> {
  const token = await getJXchangeToken();
  const envelope = wrapSoapEnvelope(action, soapXml, token);

  const response = await fetch(JXCHANGE.gatewayUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: action,
    },
    body: envelope,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`jXchange SOAP error (${response.status}): ${errorBody}`);
  }

  return response.text();
}

// ── XML Parser Helpers ───────────────────────────────────────────────

function extractElement(xml: string, tag: string): string | null {
  const regex = new RegExp(`<(?:[^:]+:)?${tag}[^>]*>([^<]*)</(?:[^:]+:)?${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

function extractAllElements(xml: string, tag: string): string[] {
  const regex = new RegExp(`<(?:[^:]+:)?${tag}[^>]*>([^<]*)</(?:[^:]+:)?${tag}>`, "gi");
  const matches: string[] = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    matches.push(match[1].trim());
  }
  return matches;
}

function extractBlock(xml: string, tag: string): string | null {
  const regex = new RegExp(`<(?:[^:]+:)?${tag}[^>]*>([\\s\\S]*?)</(?:[^:]+:)?${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1] : null;
}

// ── jXchange Service ─────────────────────────────────────────────────

export const JXchangeService = {
  /**
   * XferAdd — Initiate an ACH bank-to-bank transfer.
   *
   * Builds a SOAP XferAddRq_MType with:
   *   - AcctIdFrom_CType (source account at our institution)
   *   - ACHXferRec_CType (destination account at external institution)
   *   - XferType = "ACH"
   *
   * The response contains a XferKey used to track the transfer.
   *
   * Docs: https://jackhenry.dev/jxchange-soap/api-reference/core-services/xferadd/xferadd/
   */
  async initiateACHTransfer(req: ACHTransferRequest): Promise<ACHTransferResponse> {
    const trackingId = `FH-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const effectiveDate = req.effectiveDate || getNextBusinessDay();

    // The FromAcctId is a unique record identifier per JH docs
    // (max 15 digits, must be unique per transfer request)
    const fromAcctId = req.fromAccountId;
    const fromAcctType = req.fromAccountType === "savings" ? "SDA" : "DDA";

    // ACH credit transaction codes (NACHA standard)
    const achCrTrnCode = req.toAccountType === "savings" ? "32" : "22";

    const soapBody = `
    <tpg:XferAdd>
      <tpg:XferAddRq_MType>
        ${buildJXchangeHeader(trackingId)}
        <tpg:XferType>${JXCHANGE.xferTypes.ach}</tpg:XferType>
        <tpg:AcctIdFrom_CType>
          <tpg:AcctId>${fromAcctId}</tpg:AcctId>
          <tpg:AcctType>${fromAcctType}</tpg:AcctType>
        </tpg:AcctIdFrom_CType>
        <tpg:Amt>${req.amount.toFixed(2)}</tpg:Amt>
        <tpg:EffDt>${effectiveDate}</tpg:EffDt>
        <tpg:ACHXferRec_CType>
          <tpg:ACHCrAcctId>${req.toAccountNumber}</tpg:ACHCrAcctId>
          <tpg:ACHCrAcctType>${req.toAccountType === "savings" ? "SDA" : "DDA"}</tpg:ACHCrAcctType>
          <tpg:ACHCrName>${escapeXml(req.toAccountHolderName)}</tpg:ACHCrName>
          <tpg:ACHCrTrnCode>${achCrTrnCode}</tpg:ACHCrTrnCode>
          <tpg:ACHCompName>${escapeXml(req.achCompanyName || JXCHANGE.institution.consumerName)}</tpg:ACHCompName>
          <tpg:ACHCompId>${req.achCompanyId || JXCHANGE.institution.routingId}</tpg:ACHCompId>
          <tpg:ACHCompEntryDesc>${escapeXml(req.achEntryDescription || "PAYMENT")}</tpg:ACHCompEntryDesc>
          <tpg:ACHRtNbr>${req.toRoutingNumber}</tpg:ACHRtNbr>
        </tpg:ACHXferRec_CType>
        ${req.memo ? `<tpg:Memo>${escapeXml(req.memo)}</tpg:Memo>` : ""}
      </tpg:XferAddRq_MType>
    </tpg:XferAdd>`;

    const responseXml = await sendSoapRequest(JXCHANGE.actions.xferAdd, soapBody);

    // Parse the response
    const rsStat = extractElement(responseXml, "RsStat");
    const xferKey = extractElement(responseXml, "XferKey");

    // Check for SOAP Fault
    if (responseXml.includes("Fault") || !rsStat) {
      const faultString = extractElement(responseXml, "faultstring");
      const errCode = extractElement(responseXml, "ErrCode");
      throw new Error(
        `XferAdd failed: ${faultString || "Unknown error"} (ErrCode: ${errCode || "N/A"})`
      );
    }

    return {
      xferKey: xferKey || "",
      status: rsStat === "Success" ? "accepted" : "rejected",
      rsStat: rsStat || "Unknown",
      effectiveDate,
      traceNumber: extractElement(responseXml, "TraceNbr") || undefined,
    };
  },

  /**
   * XferSrch — Search for transfer details by account or XferKey.
   *
   * Used to check the status of an ACH transfer, retrieve settlement
   * details, or look up return codes.
   *
   * To find both internal and ACH transfers, call twice with
   * XferType = "Fut" (internal) and XferType = "ACH" (external).
   *
   * Docs: https://jackhenry.dev/jxchange-soap/api-reference/core-services/xfersrch/
   */
  async searchTransfer(params: {
    accountId?: string;
    accountType?: string;
    xferKey?: string;
    xferType?: string;
    toOrFrom?: "To" | "From" | "";
    maxRec?: number;
  }): Promise<XferSearchResult[]> {
    const trackingId = `FH-SRCH-${Date.now()}`;

    let searchCriteria = "";
    if (params.xferKey) {
      searchCriteria = `<tpg:XferKey>${params.xferKey}</tpg:XferKey>`;
    }
    if (params.accountId) {
      searchCriteria += `
        <tpg:AcctId>${params.accountId}</tpg:AcctId>
        <tpg:AcctType>${params.accountType || "DDA"}</tpg:AcctType>`;
    }

    const soapBody = `
    <tpg:XferSrch>
      <tpg:XferSrchRq_MType>
        <tpg:SrchMsgRqHdr>
          ${buildJXchangeHeader(trackingId)}
          <tpg:MaxRec>${params.maxRec || 50}</tpg:MaxRec>
        </tpg:SrchMsgRqHdr>
        ${searchCriteria}
        ${params.xferType ? `<tpg:XferType>${params.xferType}</tpg:XferType>` : ""}
        ${params.toOrFrom !== undefined ? `<tpg:ToOrFrom>${params.toOrFrom}</tpg:ToOrFrom>` : ""}
      </tpg:XferSrchRq_MType>
    </tpg:XferSrch>`;

    const responseXml = await sendSoapRequest(JXCHANGE.actions.xferSrch, soapBody);

    return this.parseXferSearchResponse(responseXml);
  },

  /**
   * Convenience: Look up a specific transfer by its XferKey.
   */
  async getTransferByKey(xferKey: string): Promise<XferSearchResult | null> {
    const results = await this.searchTransfer({ xferKey });
    return results.length > 0 ? results[0] : null;
  },

  /**
   * Convenience: Get all ACH transfers for an account.
   */
  async getACHTransfers(accountId: string, accountType: string = "DDA"): Promise<XferSearchResult[]> {
    return this.searchTransfer({
      accountId,
      accountType,
      xferType: JXCHANGE.xferTypes.ach,
    });
  },

  /**
   * Parse the XferSrchRs_MType SOAP response into typed results.
   */
  parseXferSearchResponse(xml: string): XferSearchResult[] {
    const results: XferSearchResult[] = [];

    // Extract XferSrchRec blocks from the XferSrchRecArray
    const arrayBlock = extractBlock(xml, "XferSrchRecArray");
    if (!arrayBlock) return results;

    // Split into individual records
    const recordRegex = /<(?:[^:]+:)?XferSrchRec[^>]*>([\s\S]*?)<\/(?:[^:]+:)?XferSrchRec>/gi;
    let match;
    while ((match = recordRegex.exec(arrayBlock)) !== null) {
      const rec = match[1];

      // Extract ACH details if present
      const achBlock = extractBlock(rec, "ACHXferRec");
      let achDetails: XferSearchResult["achDetails"] = undefined;
      if (achBlock) {
        achDetails = {
          traceNumber: extractElement(achBlock, "TraceNbr") || "",
          companyName: extractElement(achBlock, "ACHCompName") || "",
          companyId: extractElement(achBlock, "ACHCompId") || "",
          entryDescription: extractElement(achBlock, "ACHCompEntryDesc") || "",
          returnCode: extractElement(achBlock, "ACHRetCd") || undefined,
          returnReason: extractElement(achBlock, "ACHRetDesc") || undefined,
          settlementDate: extractElement(achBlock, "SettlDt") || undefined,
        };
      }

      results.push({
        xferKey: extractElement(rec, "XferKey") || "",
        fromAccountId: extractElement(rec, "AcctIdFrom") || extractElement(rec, "AcctId") || "",
        fromAccountType: extractElement(rec, "AcctTypeFrom") || extractElement(rec, "AcctType") || "",
        toAccountId: extractElement(rec, "AcctIdTo") || "",
        toAccountType: extractElement(rec, "AcctTypeTo") || "",
        amount: parseFloat(extractElement(rec, "Amt") || "0"),
        xferType: (extractElement(rec, "XferType") || "ACH") as XferSearchResult["xferType"],
        status: mapXferStatus(
          extractElement(rec, "XferStat") || extractElement(rec, "Stat") || "",
          achDetails?.returnCode
        ),
        effectiveDate: extractElement(rec, "EffDt") || "",
        createDate: extractElement(rec, "CreDt") || extractElement(rec, "CrtDt") || "",
        achDetails,
      });
    }

    return results;
  },
};

// ── Helpers ──────────────────────────────────────────────────────────

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getNextBusinessDay(): string {
  const date = new Date();
  // Move to next day
  date.setDate(date.getDate() + 1);
  // Skip weekends
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }
  return date.toISOString().split("T")[0];
}

/**
 * Map jXchange transfer status values to our normalized ACH status.
 * Also considers ACH return codes to determine the scenario.
 */
function mapXferStatus(
  xferStat: string,
  achReturnCode?: string
): ACHTransactionStatus {
  const stat = xferStat.toLowerCase();

  // If there's an ACH return code, it's a return/rejection
  if (achReturnCode) {
    return "returned";
  }

  if (stat === "settled" || stat === "complete" || stat === "posted") return "settled";
  if (stat === "submitted" || stat === "sent") return "submitted";
  if (stat === "accepted" || stat === "active") return "accepted";
  if (stat === "rejected" || stat === "declined" || stat === "fault") return "rejected";
  if (stat === "cancelled" || stat === "deleted") return "cancelled";
  if (stat === "pending" || stat === "scheduled") return "pending";

  return "pending";
}
