# DLC Oracle Attestation Signing Issue

## Summary
There is an inconsistency between the DLC specification and dlcdevkit's implementation of oracle attestation message signing. dlcdevkit is incorrectly hashing the outcome twice, while the DLC spec and other implementations (bitcoin-s, bip-schnorr) only hash it once as part of the tagged hash construction.

## The Issue

### What the DLC Spec Says
According to the [DLC Oracle specification](https://github.com/discreetlogcontracts/dlcspecs/blob/master/Oracle.md):

```
The algorithm Sign(sk, message, tag) is defined as:
* Let H = tag_hash("DLC/oracle/" || tag)
* Let m = H(message)
* Return BIP340_sign(sk, m)
```

For attestations, the tag is `"attestation/v0"`, making the full tag `"DLC/oracle/attestation/v0"`.

Per BIP340, a tagged hash is defined as:
```
hash_tag(x) = SHA256(SHA256(tag) || SHA256(tag) || x)
```

Therefore, for an outcome string, the oracle should sign:
```
SHA256(SHA256("DLC/oracle/attestation/v0") || SHA256("DLC/oracle/attestation/v0") || outcome_bytes)
```

### What dlcdevkit Does (INCORRECT)
In `dlcdevkit/dlc-messages/src/oracle_msgs.rs`:

```rust
pub fn tagged_attestation_msg(outcome: &str) -> Message {
    let tag_hash = bitcoin::hashes::sha256::Hash::hash(ORACLE_ATTESTATION_TAG);
    let outcome_hash = bitcoin::hashes::sha256::Hash::hash(outcome.as_bytes()); // <-- BUG: Extra hash!
    let mut hash_engine = bitcoin::hashes::sha256::Hash::engine();
    hash_engine.input(&tag_hash[..]);
    hash_engine.input(&tag_hash[..]);
    hash_engine.input(&outcome_hash[..]); // <-- Using H(outcome) instead of outcome
    let hash = bitcoin::hashes::sha256::Hash::from_engine(hash_engine);
    Message::from_digest(hash.to_byte_array())
}
```

This computes:
```
SHA256(SHA256(tag) || SHA256(tag) || SHA256(outcome))
```

The bug is the extra `SHA256(outcome)` - the outcome is being hashed twice.

### What It Should Be
The correct implementation would be:

```rust
pub fn tagged_attestation_msg(outcome: &str) -> Message {
    let tag_hash = bitcoin::hashes::sha256::Hash::hash(ORACLE_ATTESTATION_TAG);
    let mut hash_engine = bitcoin::hashes::sha256::Hash::engine();
    hash_engine.input(&tag_hash[..]);
    hash_engine.input(&tag_hash[..]);
    hash_engine.input(outcome.as_bytes()); // <-- Direct bytes, no extra hash!
    let hash = bitcoin::hashes::sha256::Hash::from_engine(hash_engine);
    Message::from_digest(hash.to_byte_array())
}
```

## Implementation Comparison

### ✅ Correct Implementations

**bitcoin-s (Scala)**:
```scala
def sha256DLCAttestation(bytes: ByteVector): Sha256Digest = {
    sha256(dlcAttestationTagBytes ++ bytes)
}
```
Where `dlcAttestationTagBytes` is pre-computed as `SHA256(tag) || SHA256(tag)`.
Result: `SHA256(SHA256(tag) || SHA256(tag) || outcome)`

**bip-schnorr (JavaScript)**:
```javascript
function taggedHash(tag, msg) {
  const tagHash = convert.hash(tag);
  return convert.hash(concat([tagHash, tagHash, Buffer.from(msg)]));
}
```
Result: `SHA256(SHA256(tag) || SHA256(tag) || outcome)`

**node-dlc OracleAttestation validation**:
```javascript
const msg = math.taggedHash('DLC/oracle/attestation/v0', outcome);
verify(this.oraclePubkey, msg, sig);
```
Expects: `SHA256(SHA256(tag) || SHA256(tag) || outcome)`

### ❌ Incorrect Implementation

**dlcdevkit (Rust)**:
Computes: `SHA256(SHA256(tag) || SHA256(tag) || SHA256(outcome))`

## Impact

This inconsistency means:
1. Oracles using dlcdevkit will produce signatures that are incompatible with other DLC implementations
2. Adaptor signatures created expecting dlcdevkit-style attestations won't work with spec-compliant oracles
3. To maintain compatibility with dlcdevkit, implementations need to add an extra hash that shouldn't be there

## Workaround for Compatibility

To maintain compatibility with dlcdevkit while it has this bug, implementations can use:

```javascript
// For dlcdevkit compatibility (incorrect per spec)
function computeTaggedAttestationMessage(outcome) {
  const tag = Buffer.from('DLC/oracle/attestation/v0', 'utf8');
  const tagHash = sha256(tag);
  const outcomeHash = sha256(Buffer.from(outcome, 'utf8')); // Extra hash for dlcdevkit
  return sha256(Buffer.concat([tagHash, tagHash, outcomeHash]));
}
```

Instead of the correct:

```javascript
// Correct per DLC spec
function computeTaggedAttestationMessage(outcome) {
  return taggedHash('DLC/oracle/attestation/v0', Buffer.from(outcome, 'utf8'));
}
```

## Recommendation

1. **dlcdevkit should be fixed** to comply with the DLC specification by removing the extra hash on the outcome
2. **Until fixed**, implementations interfacing with dlcdevkit need to use the incorrect double-hashing approach for compatibility
3. **Version detection** or **configuration flags** may be needed to support both correct and dlcdevkit-style attestations

## Test Vectors

For outcome string `"1"` (0x31 in hex):

**Correct (per spec)**:
- Tagged attestation message: `00be2b1d8b6da97d5c26e826c2dc7647adfec2ff107d1e4d8ea8041ed8d29453`

**dlcdevkit (incorrect)**:
- Hashes outcome first: `SHA256("1") = 6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b`
- Then creates tagged message: `SHA256(SHA256(tag) || SHA256(tag) || 6b86b...)`
- Result: `c85c902497797af0bb7c088ff456e6a5c38f013f4f9f0b80f06af99e96c53b8e`

This discrepancy in the message hash will cause signature verification failures when mixing implementations.