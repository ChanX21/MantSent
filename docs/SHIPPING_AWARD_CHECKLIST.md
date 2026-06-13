# MantSent Shipping Award Checklist

This checklist maps MantSent to the deployment milestone award requirements.

## Technical Deployment

- Smart contract deployed on Mantle Testnet:
  - `MantSentSignalLedger`
  - Mantle Sepolia address: `0x727D5784C001808D39C5c4a85Cb27BcE748Ae879`
- Contract verification:
  - Verify `contracts/MantSentSignalLedger.sol` on Mantle Explorer before submission.
  - Include the verified explorer link in the DoraHacks submission.
- AI-powered function with on-chain output:
  - Telegram configures the agent with Groq/OpenAI/Ollama/template explanations.
  - When a live Mantle transaction matches the policy, MantSent builds an AI-assisted incident explanation and writes an `AlertCommitted` proof to `MantSentSignalLedger`.
  - Operator review writes `OutcomeRecorded` to the same ledger.

## Product Completeness

- Public frontend:
  - Deploy the app to a public URL, not localhost.
  - Set `MANTSENT_DASHBOARD_BASE_URL=https://your-public-app-domain`.
  - `/dashboard` in Telegram returns the scoped public analytics URL.
- Deployment address:
  - Include `0x727D5784C001808D39C5c4a85Cb27BcE748Ae879`, or the latest deployed/verified address, in DoraHacks.
- Demo video:
  - Record at least 2 minutes.
  - Show `/start`, `/dashboard`, `/deploy`, `/watch`, `/policy`, `/monitor`, a triggered alert or recorded proof, and the public analytics dashboard.

## Documentation

- Open-source GitHub repo with:
  - setup instructions in `README.md`
  - architecture overview in `docs/ARCHITECTURE.md`
  - deployment guide in `docs/DEPLOYMENT.md`
  - deployed contract address in `README.md` and `docs/ARCHITECTURE.md`

## Final Submission Notes

- Use a public HTTPS app URL for the frontend demo.
- Use Mantle Explorer links for the contract and proof transactions.
- Keep `MANTSENT_ENABLE_DEMO_MODE=false` for the submitted deployment unless the demo clearly labels simulated evidence.
