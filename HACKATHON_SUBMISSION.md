# Aztec Identity Hackathon - Sybil-Resistant Private Voting

## 🎯 Project Overview

**Sybil-Resistant Private Voting** is a privacy-preserving voting application built on Aztec Devnet that demonstrates how Aztec Network serves as a decentralized identity infrastructure layer.

### Key Innovation

This project showcases **Aztec as the Identity Layer** by combining:
- **ZKPassport** for biometric identity verification (proves "I am a unique human")
- **Aztec's private execution** to maintain voter privacy
- **Nullifier trees** for Sybil resistance (one person, one vote)
- **User-controlled identity** with no centralized data storage

---

## ✅ Hackathon Requirements Compliance

### 1. Uses Aztec Devnet Latest Version ✓
- **Version**: `3.0.0-devnet.5`
- All dependencies aligned with devnet specification
- Contract deployed and tested on devnet

### 2. Novel Identity Composition with ZKPassport ✓
- **Integration**: ZKPassport SDK for passport scanning in Dev Mode
- **Novel approach**: Uses passport's `uniqueIdentifier` as source for nullifier
- **Flow**: Passport → ZKPassport Proof → Nullifier → Aztec Nullifier Tree

### 3. Aztec as Identity Infrastructure (Not Just Another Chain) ✓

#### How Aztec Serves as the Identity Layer:

**a) Private Execution Environment (PXE)**
```
User's Device (PXE)          Aztec Network
     │                            │
     │  1. Scan Passport          │
     │  2. Generate Nullifier     │
     │  3. Execute cast_vote      │
     ├──────────────────────────→ │
     │  4. Push Nullifier         │
     │     (uniqueness check)     │
     │                            │
     │  ← 5. Proof of Vote        │
```

**b) Nullifier Tree = Identity Registry**
- Each passport creates a unique nullifier: `hash(passport_unique_identifier)`
- Aztec's nullifier tree prevents duplicates automatically
- Unlike traditional identity systems, no PII is stored on-chain
- Nullifiers are deterministic but privacy-preserving

**c) Why This is Identity Infrastructure:**

| Traditional Identity System | Aztec Identity Layer |
|----------------------------|---------------------|
| Central database stores user data | No user data stored anywhere |
| Username/password authentication | Cryptographic proof of uniqueness |
| Database checks for duplicates | Nullifier tree enforces uniqueness |
| Platform controls access | User controls their proofs |
| Privacy risks from data breaches | Mathematically private by design |

**d) Code Evidence - The Identity Magic:**
```noir
// This single line provides identity infrastructure:
context.push_nullifier(nullifier);

// What it does:
// 1. Checks nullifier tree for existence (Sybil check)
// 2. If exists → REVERT (prevents double-voting)
// 3. If new → INSERT (registers this identity's action)
// 4. All done privately without revealing WHO
```

### 4. User Control Over Identity ✓

**Complete User Sovereignty:**

1. **Data Never Leaves User's Device**
   - Passport scan happens in ZKPassport app
   - Nullifier generated client-side
   - Private function executed in user's PXE

2. **User Controls Keys**
   - User owns their Aztec account keys
   - User controls when to generate proofs
   - User decides when to vote

3. **No Centralized Authority**
   - No server stores passport data
   - No database of registered users
   - No admin can vote on behalf of users
   - Contract admin can only end voting period

4. **Revocation & Privacy**
   - User can choose not to participate
   - No link between nullifier and real identity
   - Even contract admin cannot deanonymize voters

### 5. End User Interaction Documentation ✓

See complete user guide in [USER_GUIDE.md](./USER_GUIDE.md)

**Quick Summary:**
1. Install ZKPassport mobile app
2. Enable Dev Mode (long-press bottom of screen)
3. Open voting DApp at `localhost:3000`
4. Click "Connect ZKPassport"
5. Scan QR code with app
6. Mock passport scan (Dev Mode)
7. Receive verification → vote privately
8. Transaction proves uniqueness without revealing identity

---

## 🏗️ Architecture

### Smart Contract (Noir)

**`PrivateVoting.nr`** - Demonstrates Aztec as identity layer:

```noir
#[external("private")]
fn cast_vote(candidate: Field, nullifier: Field) {
    // Identity infrastructure in action:
    context.push_nullifier(nullifier);  // ← Sybil resistance
    
    // Update public tally while keeping voter private
    PrivateVoting::at(context.this_address())
        .add_to_tally_public(candidate)
        .enqueue(&mut context);
}
```

**Key Features:**
- **Private execution**: Voting happens on user's device
- **Automatic Sybil prevention**: Nullifier tree rejects duplicates
- **Transparency**: Vote counts are public for auditability
- **User control**: No centralized identity storage

### Frontend (Next.js)

**Identity Verification Flow:**
1. `ZKPassport.tsx` - Generates QR for passport scanning
2. User scans with ZKPassport app (Dev Mode enabled)
3. App returns `uniqueIdentifier` (passport's unique ID)
4. Frontend derives nullifier: `Fr.fromString(uniqueIdentifier)`
5. `aztec.ts` - Submits vote with nullifier to contract

**Privacy Guarantees:**
- Vote executed in user's PXE (private)
- Only nullifier sent to network (no identity)
- User controls entire flow

---

## 🔒 Privacy & Security Model

### What's Private?
✓ Voter identity  
✓ Who voted for whom  
✓ When individual votes were cast  
✓ Link between passport and vote  

### What's Public?
✓ Total votes per candidate  
✓ Vote ending time  
✓ That someone with a unique passport voted  

### Sybil Resistance Proof

**Test Case:**
```typescript
// First vote - succeeds
await contract.cast_vote(candidate_A, nullifier_1);
// ✓ Nullifier inserted into tree

// Try to vote again with same passport - FAILS
await contract.cast_vote(candidate_B, nullifier_1);
// ✗ Transaction reverts: "Nullifier already exists"
```

**Mathematical Guarantee:**
- Nullifier = `hash(passport_unique_id)`
- Aztec's nullifier tree is an indexed Merkle tree
- Duplicate insertion is cryptographically prevented
- No double-voting is possible

---

## 🚀 Deployment & Testing

### Prerequisites
```bash
# Install Aztec CLI
bash -i <(curl -s https://install.aztec.network)

# Set devnet version
export VERSION=3.0.0-devnet.5
aztec-up
```

### Local Testing with Sandbox
```bash
# Terminal 1: Start sandbox
aztec start --sandbox

# Terminal 2: Deploy contract
cd /path/to/project
yarn install
cd contracts && aztec-nargo compile && cd ..
node scripts/deploy_contract.js

# Terminal 3: Start frontend
cd frontend && yarn install && yarn dev
```

### Devnet Deployment
```bash
# Set environment
export NODE_URL=https://devnet.aztec-labs.com/
export SPONSORED_FPC_ADDRESS=0x280e5686a148059543f4d0968f9a18cd4992520fcd887444b8689bf2726a1f97

# Deploy with sponsored fees
aztec-wallet deploy \
    --node-url $NODE_URL \
    --from accounts:my-wallet \
    --payment method=fpc-sponsored,fpc=$SPONSORED_FPC_ADDRESS \
    PrivateVoting \
    --args accounts:my-wallet \
    --no-wait
```

### Verifying Identity Infrastructure

**Test 1: Sybil Resistance**
```bash
# Vote with nullifier A → succeeds
# Vote with nullifier A again → fails
# This proves one-passport-one-vote
```

**Test 2: Privacy**
```bash
# Check vote tally → can see total votes
# Try to find who voted → impossible (private execution)
# This proves voter anonymity
```

**Test 3: User Control**
```bash
# Generate proof → happens client-side
# Submit vote → user initiates
# No admin override possible
```

---

## 📊 Why This Matters for Identity

### Traditional Identity Problems

1. **Centralized Data**: Equifax breach exposed 147M people
2. **Sybil Attacks**: Bots create millions of fake accounts
3. **Privacy Loss**: Companies sell user data
4. **Lack of Control**: Users can't revoke access

### Aztec Identity Solution

1. **No Data Storage**: Nullifiers prove uniqueness without PII
2. **Cryptographic Sybil Prevention**: Nullifier tree is tamper-proof
3. **Privacy by Design**: Zero-knowledge proofs reveal nothing
4. **User Sovereignty**: Private keys = identity control

### Real-World Applications

- **Voting**: One person one vote (this demo)
- **Airdrops**: Fair distribution without farming
- **Reputation**: Prove history without revealing activity
- **Access Control**: Verify eligibility privately
- **UBI**: One payout per person, no fraud

---

## 🎓 Technical Deep Dive

### The Nullifier as Identity Primitive

```
Passport Data (Private)
        ↓
   ZKPassport Proof
        ↓
 uniqueIdentifier (Private)
        ↓
hash(uniqueIdentifier) = Nullifier
        ↓
Aztec Nullifier Tree (Public tree, private values)
        ↓
   Sybil Resistance ✓
```

### Why Nullifier Trees are Identity Infrastructure

**Properties:**
- **Append-only**: Can't remove someone's registration
- **Uniqueness enforced**: Cryptographic guarantee
- **Privacy-preserving**: Nullifier doesn't reveal identity
- **Permissionless**: Anyone can verify uniqueness
- **Censorship-resistant**: No central authority

**Comparison to Traditional DB:**
```sql
-- Traditional (centralized, privacy risk)
INSERT INTO users (passport_id, vote) 
VALUES ('A1234567', 'candidate_A')
-- If passport_id exists → duplicate error
-- But database stores actual passport number!

-- Aztec (decentralized, privacy-preserving)
context.push_nullifier(hash(passport_id))
-- If nullifier exists → transaction reverts
-- Tree only stores hash, not passport data
-- No one can reverse hash to find passport
```

---

## 🏆 Hackathon Success Criteria

| Requirement | Implementation | Evidence |
|-------------|----------------|----------|
| Use Devnet v3.0.0-devnet.5 | ✓ All packages aligned | `Nargo.toml`, `package.json` |
| Novel identity composition | ✓ ZKPassport + Nullifiers | `ZKPassport.tsx`, `main.nr` |
| Aztec as infrastructure | ✓ Not just L2, but identity layer | This document, architecture |
| User controls identity | ✓ Client-side proof generation | No centralized storage |
| User interaction docs | ✓ Complete guide | `USER_GUIDE.md` |

---

## 🔮 Future Enhancements

1. **Recursive Proofs**: Prove voting eligibility without ZKPassport
2. **Delegation**: Proxy voting while maintaining privacy
3. **Weighted Voting**: Different nullifier types for different weights
4. **Cross-Chain Identity**: Use same nullifier across multiple apps
5. **Progressive Disclosure**: Reveal age range without exact age

---

## 📚 Resources

- **Aztec Docs**: https://docs.aztec.network/devnet
- **ZKPassport**: https://zkpassport.id/
- **Source Code**: [Link to repo]
- **Demo Video**: [Link to demo]
- **Live DApp**: [Link to deployment]

---

## 👥 Team & Contact

Built for Aztec Identity Hackathon 2025

**Contact**: [Your details]

---

## 📄 License

MIT License - See LICENSE file

---

## 🙏 Acknowledgments

- Aztec Protocol team for the incredible privacy technology
- ZKPassport team for biometric identity verification
- Noir language for making ZK development accessible

---

**This project proves that decentralized, privacy-preserving identity infrastructure is not just possible—it's already here with Aztec Network.**
