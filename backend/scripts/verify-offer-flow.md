# Verify Offer → Respond Flow (quick local test)

These steps walk you through reproducing the flow locally using curl/PowerShell so you can confirm the code is creating Offers, sending donor emails, and notifying the requester when the donor clicks YES.

Notes:
- The server must be running (from `backend` folder: `npm start`) and `.env` must contain a valid `MONGO_URI` and working SMTP credentials.
- If you use Firebase for auth, you'll need ID tokens (get them from the app in browser console via `firebaseAuth.currentUser.getIdToken()`).

1) Create a request (as an authenticated user)

Replace <ID_TOKEN> with the Firebase id token of the requester and <API_BASE> if your server runs on a different host.

```powershell
$token = '<ID_TOKEN>'
$body = @{ name='Alice'; phone='+919876543210'; bloodGroup='B+'; units=1; hospital='Test Hospital' } | ConvertTo-Json
curl -X POST 'http://localhost:5000/api/requests/create' -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d $body
```

The server will respond with JSON including `requestId`.

2) Create an offer (donor clicks Call/Navigate). The donor must be authenticated or must provide a phone number.
  Note: Phone is required for creating an offer because the requester needs a number to contact the donor. If the donor is logged-in, the server will prefer the donor's profile phone/age saved in the backend; if the DB user record lacks a phone but Firebase has a phone number, the server will fetch it from Firebase and persist it so the donor will NOT be prompted.

  UI behavior: when a donor clicks CALL or NAVIGATE the app now shows a polite modal (pre-filled with profile phone/age when available). Choices:
  - Save & Continue — the donor's phone (and optional age) will be saved and the app will create the Offer, then open the chosen external action (call or maps) in a new tab / dialer.
  - Not now — the modal closes and the app shows a polite thank-you message (no browser or phone dialer is opened).

Replace <DONOR_TOKEN> and <REQUEST_ID>.

```powershell
$donorToken = '<DONOR_ID_TOKEN>'
$reqId = '<REQUEST_ID>'
$payload = @{ requestId = $reqId } | ConvertTo-Json
curl -X POST 'http://localhost:5000/api/notify/offer' -H "Authorization: Bearer $donorToken" -H "Content-Type: application/json" -d $payload
```

The endpoint returns { ok: true, offerId: ..., whatsapp: '...' } and (if donor has email) the server will email the donor with YES/NO links.

3) Simulate the donor clicking YES

If you receive the donor email, the email contains a link like: `GET /api/notify/offer/respond?token=<offer-token>&resp=yes`.
You can also call that directly (replace `<offer-token>`):

```powershell
$token = '<offer-token>'
curl "http://localhost:5000/api/notify/offer/respond?token=$token&resp=yes"
```

Expected behavior & logs
- If the Request was created by a logged-in user (so the request `uid` exists), `respondOffer` will resolve the requester's email from the saved request `email` or the linked `User` record and will send them an email listing the donor's name, age, phone and email.
- If the request was anonymous (no `uid` or `email`) the server will log a WhatsApp prefilled link and create an in-app `Notification` (if the request has `uid` mapping to a user). You should see a console log like:
  "respondOffer: requester no email, WhatsApp link: https://wa.me/..."

WhatsApp behavior
- When the donor clicks YES, the server will now attempt to notify the requester by WhatsApp in addition to email. There are two modes:
  * If you configure Twilio (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN & TWILIO_WHATSAPP_FROM) the server will send a WhatsApp message programmatically (recommended for automations, but requires a paid Twilio/WhatsApp account).
  * If Twilio is not configured, the server will generate a wa.me prefilled link and create an in-app Notification containing that WhatsApp link. The requester can open the link to view the message and confirm.

The WhatsApp message includes two confirmation links which point to the app follow-up endpoint (so if the requester clicks YES/NO from WhatsApp and opens the link, the server records the response and awards coins when applicable). This allows confirmations from either the email or WhatsApp channel to be treated the same.

Troubleshooting
- If the server doesn't find an email for the requester, confirm the request has `uid` or `email`. The `Request` schema originally does not contain `email`; logged-in users' requests will attach their `uid` (server uses Authorization token to set `uid`). If you want anonymous requesters to receive email notifications, modify the request flow to collect an email (or update the `Request` schema to include `email`).

- If `sendMail` logs show the SMTP server accepted the message but you don't see the mail in the inbox, ensure your SMTP relay (Brevo) has the sender authenticated and correct DNS/SPF/DKIM in place for production deliverability.

If you'd like, I can also: add an optional `email` field to `Request` schema and include it in the frontend request form so anonymous requesters can receive emails; or, add an admin script to back-fill `uid` for existing requests if you can provide an admin API token mapping from owner phone to uid.
