# myPay

A sample payroll application — demonstrates an end-to-end payroll flow
powered by the [Root](https://www.useroot.com) platform
([`root-pay-js-sdk`](https://github.com/root-credit/root-pay-js-sdk)).

## The story

myPay is used by the **payroll admin** at an employer. The flow:

1. **Sign in with Google Workspace** — the email's **domain** identifies the
   tenant.  The first admin from `@acme.com` provisions a new Root subaccount
   for Acme; every subsequent admin with an `@acme.com` email joins the same
   tenant (same subaccount, same employees).  **Logout** just clears the
   current session — teammates can keep working.
2. **Employees = Root payees.**  On login myPay calls `GET /v1/payees` for
   the tenant's subaccount and reconciles with the local HCM.  Anything that
   already lives in your Root sandbox shows up as an employee automatically.
   Conversely, every employee you add in myPay is created as a payee on Root
   via `POST /v1/payees`.
3. **Link each employee's bank account** through the Root JS SDK — myPay never
   touches raw account numbers, just Root bank-account tokens.  The bank is
   attached to the payee so it follows them across sessions.
4. **Link the employer's bank account** through the same Root SDK — this
   authorizes an **ACH debit pull** from the employer's operating account into
   the myPay Root subaccount.
5. **Prefund the subaccount** by initiating an ACH debit pull for the upcoming
   pay period's gross total.
6. **Run payroll** — one click disburses every employee's net paycheck from the
   subaccount via ACH / RTP, all through Root.

## Getting started

```bash
npm install
cp .env.example .env.local   # default is mock mode — no credentials needed
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Mock vs. live Root sandbox

myPay talks to Root through a single client in
[`src/services/root.ts`](src/services/root.ts).  Two implementations ship:

| Mode                    | `VITE_USE_MOCK_ROOT` | Behavior                                                                                     |
| ----------------------- | :------------------: | -------------------------------------------------------------------------------------------- |
| **Client-side mock**    | `true` *(default)*   | Deterministic local simulation, timed settlement, nothing leaves the browser.                |
| **Live Root sandbox**   | `false`              | All calls go to `/api/root/*` — Vite proxies to Root's sandbox and injects the secret key.   |

### Wiring up live mode

1. Put your sandbox credentials in `.env.local`:
   ```env
   VITE_USE_MOCK_ROOT=false
   ROOT_SANDBOX_API_KEY=root_sk_sandbox_your_key_here
   ROOT_SANDBOX_BASE_URL=https://sandbox.api.useroot.com
   ```
   `ROOT_SANDBOX_API_KEY` is intentionally **not** prefixed with `VITE_` — it
   lives only in the Vite dev-server process and is never bundled into the
   browser JavaScript.

2. Restart `npm run dev`.

3. The Vite dev-server (see [`vite.config.ts`](vite.config.ts)) forwards every
   request to `/api/root/*` to `${ROOT_SANDBOX_BASE_URL}/v1/*` and attaches
   `Authorization: Bearer ${ROOT_SANDBOX_API_KEY}` along the way.

### Production

The dev proxy only runs in `vite dev`.  For a deployed myPay, replace it with a
real backend that performs the same header injection — a thin Express server,
a Vercel/Netlify function at `/api/root/[...path].ts`, or a Cloudflare Worker
all work.  `services/root.ts` does not change.

### Schema caveat

The exact request/response shapes in `apiClient` (payload field names, HTTP
status conventions, webhook events) are **best-guess placeholders** based on
Root's public description of the platform.  Once you have access to Root's
reference docs, adjust the `apiClient` methods in `src/services/root.ts`
— no other file needs to change.

## Architecture

```
src/
├── components/       Layout, RootLinkModal (simulates the Root JS SDK UI),
│                     AppProvider, RequireAuth
├── pages/            Login, Dashboard, Employees, CompanyBank, Funding,
│                     Payroll, RootActivity
├── services/
│   └── root.ts       RootClient interface + mock & api implementations,
│                     plus applySubaccount/applyBankToken/applyTransfer
│                     helpers that commit a ClientResult to a RootState.
├── state/
│   └── store.ts      localStorage-backed app store with settlement ticker
│                     (mock mode only).
├── lib/              money + payroll math utilities
└── types/            Employer, Employee, RootSubaccount, RootBankToken,
                      RootTransfer, PayrollRun, RootActivityEntry
```

## Tech

- React 18 + TypeScript + Vite
- Tailwind CSS
- React Router
- Lucide React (icons)
