---
'@atomicfinance/bitcoin-ddk-provider': patch
---

Fix execute failing with InvalidSignature after DLC messages are serialized and deserialized. @node-dlc/messaging splits the 162-byte ECDSA adaptor signature into encryptedSig (65) + dleqProof (97) on deserialize, but the signCet call sites passed encryptedSig alone; they now recombine the full adaptor signature.
