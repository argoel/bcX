# myPay

A sample payroll application — demonstrates an end-to-end payroll flow
powered by the [Root](https://www.useroot.com) platform
([`root-pay-js-sdk`](https://github.com/root-credit/root-pay-js-sdk)).

## The story

myPay is used by the **payroll admin** at an employer. The flow:

1. **Sign in with Google Workspace** — creates the employer account and, under
   the hood, provisions a dedicated myPay **subaccount on Root** (sandbox).
2. **Add employees** one-by-one in the built-in HCM.
3. **Link each employee's bank account** through the Root JS SDK — myPay never
   touches raw account numbers, just Root bank-account tokens.
4. **Link the employer's bank account** through the same Root SDK — this
   authorizes an **ACH debit pull** from the employer's operating account into
   the myPay Root subaccount.
5. **Prefund the subaccount** by initiating an ACH debit pull for the upcoming
   pay period's gross total.
6. **Run payroll** — one click disburses every employee's net paycheck from the
   subaccount via ACH / RTP, all through Root.

All state is kept in `localStorage` and all Root interactions are routed
through a single client (`src/services/root.ts`) so the SDK / API calls can be
swapped for real sandbox calls later.

## Getting started

```bash
npm install
npm run dev
```

## Tech

- React 18 + TypeScript + Vite
- Tailwind CSS
- React Router
- Lucide React (icons)
- Mocked Root sandbox (swap `src/services/root.ts` for real calls)
