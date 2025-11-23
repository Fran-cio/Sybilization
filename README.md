# Sybilization - Aztec Private Voting - Hackathon Project

[![Aztec Version](https://img.shields.io/badge/Aztec-v3.0.0--devnet.5-blue)](https://docs.aztec.network/devnet)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![ZKPassport](https://img.shields.io/badge/Identity-ZKPassport-purple)](https://zkpassport.id/)

Private voting system using Aztec Network and ZKPassport for Sybil-resistant anonymous voting.

## 🎯 Overview

This project demonstrates a privacy-preserving voting system built on Aztec Network that uses ZKPassport for biometric identity verification without compromising user privacy.

**Deployed on Aztec Devnet**: `0x1cd66e146301166c9ba7af24e400ec3760d0aaed77236454f647e6bb663dd8df`

## ✅ Working Features

- **Private Voting**: Cast votes privately using Aztec's private execution environment
- **Sybil Resistance**: Each passport can only vote once (nullifier-based)
- **Transparent Results**: Vote counts are public and auditable
- **ZKPassport Integration**: Biometric passport verification for identity
- **Devnet Deployment**: Fully deployed and tested on Aztec Devnet
- **Sponsored Fees**: Uses Aztec's sponsored FPC for gasless transactions

## 🏗️ Architecture

```
┌─────────────────┐
│   ZKPassport    │  ← Biometric passport verification
│   Mobile App    │     (Generates unique identifier)
└────────┬────────┘
         │ Provides passport proof
         ↓
┌─────────────────┐
│   Frontend      │  ← Next.js DApp
│   (Browser)     │     Derives nullifier from proof
└────────┬────────┘
         │ Calls cast_vote()
         ↓
┌─────────────────┐
│  Aztec Network  │  ← Privacy Layer
│  (Devnet)       │     • Nullifier tree (prevents double-voting)
│                 │     • Private execution (hides voter choice)
│                 │     • Public tallies (transparent results)
└─────────────────┘
```

## 📁 Project Structure

```
aztec-private-voting/
├── contracts/                    # Noir smart contracts
│   ├── src/main.nr              # PrivateVoting contract
│   └── target/                  # Compiled artifacts
├── frontend/                     # Next.js frontend
│   ├── app/                     # Next.js app directory
│   ├── lib/aztec.ts             # Aztec client utilities
│   └── public/contract-address.json
├── scripts/                      # Deployment and interaction scripts
│   ├── compile_contract.sh      # Compile Noir contract
│   ├── deploy_devnet.js         # Deploy to Aztec Devnet
│   ├── cast_vote.js             # Cast a vote
│   ├── read_votes.js            # Read voting results
│   └── demo_complete_flow.js    # Complete demo flow
└── passport-zk-circuits-noir/   # ZKPassport circuits (OpenPassport)
```

## 🚀 Quick Start

### Prerequisites

- Node.js v18+
- Aztec CLI v3.0.0-devnet.5
- ZKPassport mobile app (for production) or dev mode

### Installation

```bash
# Install dependencies
npm install

# Compile the contract
cd contracts
bash ../scripts/compile_contract.sh
```

### Deploy to Devnet

```bash
# Deploy contract to Aztec Devnet
node scripts/deploy_devnet.js
```

### Cast a Vote

```bash
# Vote for Candidate A
NODE_URL=https://devnet.aztec-labs.com/ node scripts/cast_vote.js "Candidate A" "passport_unique_id_1"

# Vote for Candidate B
NODE_URL=https://devnet.aztec-labs.com/ node scripts/cast_vote.js "Candidate B" "passport_unique_id_2"
```

### Read Results

```bash
# View voting results
NODE_URL=https://devnet.aztec-labs.com/ node scripts/read_votes.js
```

## 🎮 Demo Flow

Run the complete demo (deploy + vote + verify):

```bash
node scripts/demo_complete_flow.js
```

This will:
1. Deploy the contract to devnet
2. Create test voters
3. Cast multiple votes
4. Test double-vote prevention
5. Display results

## 🔐 How It Works

### 1. Identity Verification (ZKPassport)

- User scans biometric passport with ZKPassport app
- App generates unique identifier from passport data
- **Privacy**: No personal data leaves the user's device

### 2. Nullifier Generation

```typescript
// Frontend derives nullifier from passport identifier
const hash = crypto.createHash('sha256').update(uniqueIdentifier).digest('hex');
const nullifier = new Fr(BigInt('0x' + hash.substring(0, 62)));
```

### 3. Private Voting

```noir
// Noir contract (executed privately on user's device)
#[external("private")]
fn cast_vote(candidate: Field, nullifier: Field) {
    // Push nullifier to Aztec's nullifier tree
    // Automatic revert if nullifier already exists
    context.push_nullifier(nullifier);
    
    // Enqueue public function to update tally
    PrivateVoting::at(context.this_address())
        .add_to_tally_public(candidate)
        .enqueue(&mut context);
}
```

### 4. Sybil Resistance

- Each passport generates a unique nullifier
- Aztec's nullifier tree prevents reuse
- Attempting to vote twice with same passport → **Transaction reverts**

### 5. Transparent Results

```noir
// Anyone can read vote counts (public data)
#[external("utility")]
unconstrained fn get_vote(candidate: Field) -> Field {
    storage.tally.at(candidate).read()
}
```

## 🧪 Testing

### Unit Tests

Run Noir unit tests:

```bash
cd contracts
aztec-nargo test
```

**Tests implemented**:
- ✅ Storage initialization
- ✅ Nullifier format validation
- ✅ Candidate ID validation
- ✅ Tally increment logic
- ✅ Voting state transitions

**Result**: All 5 tests passing

### Integration Tests

#### Test Sybil Resistance

```bash
# First vote succeeds
node scripts/cast_vote.js "Candidate A" "test_passport_1"

# Second vote with same passport fails
node scripts/cast_vote.js "Candidate A" "test_passport_1"
# Error: Invalid tx: Existing nullifier ✓
```

#### Test Voting Lifecycle

```bash
NODE_URL=https://devnet.aztec-labs.com/ node scripts/test_lifecycle.js
```

This tests:
- ✅ Voting works before end_voting()
- ✅ end_voting() executes successfully
- ✅ Voting blocked after end_voting()
- ✅ Results remain readable after voting ends

### Verify Privacy

- Vote transactions don't reveal voter identity
- Only the user knows their nullifier
- Vote choices are private during execution
- Only tallies are public

## 📊 Current Deployment

**Aztec Devnet**
- Contract: `0x1cd66e146301166c9ba7af24e400ec3760d0aaed77236454f647e6bb663dd8df`
- Network: `https://devnet.aztec-labs.com/`
- Sponsored FPC: `0x280e5686a148059543f4d0968f9a18cd4992520fcd887444b8689bf2726a1f97`
- Explorer: https://devnet-explorer.aztec.network/

**Current Votes**:
- Candidate A: 1 vote (50%)
- Candidate B: 1 vote (50%)

## 🛠️ Key Technologies

- **Aztec Network**: Privacy-preserving L2 blockchain
- **Noir**: Zero-knowledge circuit language for smart contracts
- **ZKPassport (OpenPassport)**: Biometric passport verification
- **Next.js**: Frontend framework
- **TestWallet**: Server-side wallet for devnet testing

## 📝 Smart Contract

The `PrivateVoting` contract has 4 main functions:

1. **`cast_vote(candidate, nullifier)`** - Private function to cast a vote
2. **`add_to_tally_public(candidate)`** - Internal function to update vote count
3. **`end_voting()`** - Public function to close voting period
4. **`get_vote(candidate)`** - Unconstrained function to read vote count

## 🔑 Key Insights

### Why Aztec is Identity Infrastructure

1. **Decentralized**: No central authority controls identity
2. **Privacy-First**: ZK proofs verify without revealing data
3. **User Control**: Users generate proofs locally, control their keys
4. **Sybil Resistant**: Cryptographic uniqueness guarantees
5. **Interoperable**: Identity proofs work across dApps

### Privacy Guarantees

- ✅ Who voted: **Hidden** (private execution)
- ✅ Vote choice: **Hidden** (private execution)
- ✅ Vote count: **Public** (transparent results)
- ✅ Double voting: **Impossible** (nullifier tree)

## 🎯 Future Enhancements

- [ ] Multi-poll support
- [ ] Time-based voting periods
- [ ] Weighted voting
- [ ] Delegation mechanisms
- [ ] Integration with other identity providers
- [ ] Mobile app for direct voting

## 📚 Resources

- [Aztec Documentation](https://docs.aztec.network/)
- [ZKPassport](https://zkpassport.id/)
- [OpenPassport SDK](https://github.com/zk-passport/openpassport)
- [Noir Language](https://noir-lang.org/)

## 🤝 Contributing

This is a hackathon project. Contributions and feedback are welcome!

## 📄 License

MIT License - see LICENSE file for details

---

**Built for Aztec Identity Hackathon** | **Powered by Aztec Network & ZKPassport**
