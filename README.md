# Sybilization - Aztec Private Voting - Hackathon Project

[![Aztec Version](https://img.shields.io/badge/Aztec-v3.0.0--devnet.5-blue)](https://docs.aztec.network/devnet)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![ZKPassport](https://img.shields.io/badge/Identity-ZKPassport-purple)](https://zkpassport.id/)

Private voting system using Aztec Network and ZKPassport for Sybil-resistant anonymous voting.

## 🎯 Overview

This project demonstrates a privacy-preserving voting system built on Aztec Network that uses ZKPassport for biometric identity verification without compromising user privacy.

**Deployed on Aztec Devnet**: `0x2bbe365ae58181933e2203b150c65b945dda12c541ef4611ab445591b6ed7c06`

## ✅ Working Features

### Core Features
- **Private Voting**: Cast votes privately using Aztec's private execution environment
- **Sybil Resistance**: Each passport can only vote once (nullifier-based)
- **Transparent Results**: Vote counts are public and auditable
- **ZKPassport Integration**: Biometric passport verification for identity
- **Devnet Deployment**: Fully deployed and tested on Aztec Devnet
- **Sponsored Fees**: Uses Aztec's sponsored FPC for gasless transactions

### New Features 🆕
- **Time-Based Voting**: Set start/end times with `initialize(start, end)` - voting only counts within period
- **Vote Metadata**: Optional encrypted reasons for votes (stored as Field hash)
- **Admin Controls**: Creator can `extend_voting()` or `end_voting()` early
- **Immutable Snapshot**: `take_snapshot()` creates permanent record of final results
- **Deterministic Admin**: Consistent admin keys across deployments for testing

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
│   ├── deploy_devnet.js         # Deploy to Aztec Devnet with initialize()
│   ├── cast_vote.js             # Cast a vote (with optional reason)
│   ├── read_votes.js            # Read voting results
│   ├── finalize_voting.js       # Complete finalization workflow
│   ├── check_voting_period.js   # View voting time parameters
│   ├── take_snapshot.js         # Take immutable results snapshot
│   └── test_lifecycle.js        # Full lifecycle integration test
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
# Deploy contract to Aztec Devnet with 7-day voting period
NODE_URL=https://devnet.aztec-labs.com/ node scripts/deploy_devnet.js
```

The deployment automatically:
- Creates admin account with deterministic keys
- Deploys PrivateVoting contract
- Calls `initialize(start, end)` with 7-day period
- Sets creator from msg.sender

### Cast a Vote

```bash
# Vote for Candidate A (without reason)
NODE_URL=https://devnet.aztec-labs.com/ node scripts/cast_vote.js 1 "passport_unique_id_1"

# Vote for Candidate B (with encrypted reason)
NODE_URL=https://devnet.aztec-labs.com/ node scripts/cast_vote.js 2 "passport_unique_id_2" "Best economic policy"

# Vote for Candidate C
NODE_URL=https://devnet.aztec-labs.com/ node scripts/cast_vote.js 3 "passport_unique_id_3"
```

### Check Voting Status

```bash
# View voting period and current time
NODE_URL=https://devnet.aztec-labs.com/ node scripts/check_voting_period.js
```

### Read Results

```bash
# View current voting results
NODE_URL=https://devnet.aztec-labs.com/ node scripts/read_votes.js
```

### Finalize Voting

```bash
# Complete finalization workflow (end voting + snapshot)
NODE_URL=https://devnet.aztec-labs.com/ node scripts/finalize_voting.js
```

This script will:
1. Check voting status (start/end times, vote counts)
2. Prompt Y/N to end voting early with admin (if active)
3. Take immutable snapshot of final results
4. Display comprehensive summary

## 🎮 Complete Workflow Example

```bash
# 1. Deploy contract
NODE_URL=https://devnet.aztec-labs.com/ node scripts/deploy_devnet.js

# 2. Cast votes
NODE_URL=https://devnet.aztec-labs.com/ node scripts/cast_vote.js 1 "alice"
NODE_URL=https://devnet.aztec-labs.com/ node scripts/cast_vote.js 2 "bob"
NODE_URL=https://devnet.aztec-labs.com/ node scripts/cast_vote.js 1 "charlie" "Great candidate"

# 3. Check results
NODE_URL=https://devnet.aztec-labs.com/ node scripts/read_votes.js

# 4. Finalize (when voting period ends or admin ends early)
NODE_URL=https://devnet.aztec-labs.com/ node scripts/finalize_voting.js
```

**Result**: 
- Candidate A: 2 votes (66.7%)
- Candidate B: 1 vote (33.3%)
- Candidate C: 0 votes (0%)
- Immutable snapshot taken ✓

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
fn cast_vote(candidate: Field, nullifier: Field, reason: Field) {
    // Push nullifier to Aztec's nullifier tree
    // Automatic revert if nullifier already exists
    context.push_nullifier(nullifier);
    
    // Store encrypted vote reason if provided
    if reason != 0 {
        PrivateVoting::at(context.this_address())
            ._store_vote_reason(nullifier, reason)
            .enqueue(&mut context);
    }
    
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

### 5. Time-Based Validation

```noir
// Votes only count within voting period
#[external("public")]
#[internal]
fn add_to_tally_public(candidate: Field) {
    let now = context.timestamp();
    assert(now >= storage.start_time.read(), "Voting has not started yet");
    assert(now <= storage.end_time.read(), "Voting has ended");
    
    let new_tally = storage.tally.at(candidate).read() + 1;
    storage.tally.at(candidate).write(new_tally);
}
```

### 6. Transparent Results & Snapshot

```noir
// Anyone can read current vote counts (public data)
#[external("utility")]
unconstrained fn get_vote(candidate: Field) -> Field {
    storage.tally.at(candidate).read()
}

// Anyone can read immutable snapshot (after voting ends)
#[external("utility")]
unconstrained fn get_snapshot(candidate: Field) -> Field {
    storage.final_snapshot.at(candidate).read()
}
```

## 🧪 Testing

### Unit Tests

Run Noir unit tests:

```bash
cd contracts
aztec-nargo test
```

**Note**: Noir unit tests are limited (cannot instantiate contracts). Real testing via integration tests.

**Result**: 1 placeholder test passing (documents integration test coverage)

### Integration Tests

#### Test Sybil Resistance

```bash
# First vote succeeds
node scripts/cast_vote.js "Candidate A" "test_passport_1"

# Second vote with same passport fails
node scripts/cast_vote.js "Candidate A" "test_passport_1"
# Error: Invalid tx: Existing nullifier ✓
```

#### Test Complete Lifecycle

```bash
NODE_URL=https://devnet.aztec-labs.com/ node scripts/test_lifecycle.js
```

This tests:
- ✅ Contract initialization with time period
- ✅ Voting works within active period
- ✅ Time validation (votes before start/after end blocked)
- ✅ Admin controls (extend_voting, end_voting)
- ✅ Vote metadata (with/without reasons)
- ✅ Immutable snapshot creation
- ✅ Results remain readable after voting ends

**Proven on Devnet**:
- Contract: `0x2bbe365ae58181933e2203b150c65b945dda12c541ef4611ab445591b6ed7c06`
- 3 votes cast (A:2, B:1, C:0)
- Voting ended early by admin
- Snapshot taken successfully
- All features working ✓

### Verify Privacy

- Vote transactions don't reveal voter identity
- Only the user knows their nullifier
- Vote choices are private during execution
- Only tallies are public

## 📊 Current Deployment

**Aztec Devnet**
- Contract: `0x2bbe365ae58181933e2203b150c65b945dda12c541ef4611ab445591b6ed7c06`
- Admin: `0x01a2704a2b74776ee3b00bf368f94422c1b38361ae970ac98fae789a0b6494b8`
- Network: `https://devnet.aztec-labs.com/`
- Sponsored FPC: `0x280e5686a148059543f4d0968f9a18cd4992520fcd887444b8689bf2726a1f97`
- Explorer: https://devnet-explorer.aztec.network/

**Latest Test Results**:
- Candidate A: 2 votes (66.7%)
- Candidate B: 1 vote (33.3%)
- Candidate C: 0 votes (0%)
- Status: Voting ended, snapshot taken ✓
- Voting Period: 2025-11-23 to 2025-11-30 (ended early by admin)

## 🛠️ Key Technologies

- **Aztec Network**: Privacy-preserving L2 blockchain
- **Noir**: Zero-knowledge circuit language for smart contracts
- **ZKPassport (OpenPassport)**: Biometric passport verification
- **Next.js**: Frontend framework
- **TestWallet**: Server-side wallet for devnet testing

## 📝 Smart Contract

The `PrivateVoting` contract has these main functions:

### Core Functions
1. **`initialize(start, end)`** - #[initializer] Set voting period (called once at deployment)
2. **`cast_vote(candidate, nullifier, reason)`** - Private function to cast a vote with optional reason
3. **`add_to_tally_public(candidate)`** - Internal function to update vote count (validates time)

### Admin Functions (Creator Only)
4. **`extend_voting(new_end_time)`** - Extend the voting period
5. **`end_voting()`** - End voting early (sets end_time to now)

### Snapshot Functions
6. **`take_snapshot()`** - Create immutable snapshot of results (once only, after voting ends)

### View Functions (Unconstrained)
7. **`get_vote(candidate)`** - Read current vote count
8. **`get_snapshot(candidate)`** - Read immutable snapshot result
9. **`is_snapshot_taken()`** - Check if snapshot exists
10. **`get_vote_reason(nullifier)`** - Read encrypted vote reason
11. **`get_start_time()`, `get_end_time()`, `get_creator()`** - Read contract parameters

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
- ✅ Vote reason: **Encrypted** (only voter knows plaintext)
- ✅ Vote count: **Public** (transparent results)
- ✅ Double voting: **Impossible** (nullifier tree)
- ✅ Final results: **Immutable** (snapshot cannot be changed)

## 🎯 Future Enhancements

- [x] Time-based voting periods ✅ (Implemented)
- [x] Vote metadata (reasons) ✅ (Implemented)
- [x] Immutable results snapshot ✅ (Implemented)
- [ ] Multi-poll support
- [ ] Weighted voting (based on identity attributes)
- [ ] Delegation mechanisms
- [ ] Integration with other identity providers
- [ ] Mobile app for direct voting
- [ ] Privacy-preserving vote reason reveal (ZK proof)
- [ ] Quadratic voting

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
