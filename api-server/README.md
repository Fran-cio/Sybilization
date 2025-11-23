# API Server - ZKPassport Voting

Express.js API server for handling ZKPassport registration and vote casting on Aztec Network.

## Architecture

```
Frontend (Next.js)  →  API Server (Express)  →  Aztec Devnet
     │                       │                       │
     │                   Manages wallets         Processes TXs
     │                   Generates proofs        Stores votes
     │                   Handles FPC             Enforces privacy
     └─────────────────────────────────────────────┘
          User controls passport data locally
```

## Features

- **Passport Registration**: Simulates ZKPassport with age verification
- **Vote Casting**: Submits votes to Aztec using passport_hash as nullifier
- **Results Reading**: Fetches current vote tallies from contract
- **Status Checking**: Monitors voting period (start/end times)
- **Sponsored Fees**: Uses Aztec's Sponsored FPC for gasless transactions

## Endpoints

### POST /api/register-passport

Register a passport and generate a unique passport_hash.

**Request Body:**
```json
{
  "name": "John Doe",
  "dateOfBirth": "1990-05-15",
  "nationality": "USA",
  "passportNumber": "P123456789"
}
```

**Response:**
```json
{
  "success": true,
  "passportHash": "0x3931e925acb91221c2b162891c7cf52d34dd9eb503cf1992a788b004ff8d63f1",
  "ageVerified": true,
  "age": 35,
  "registeredAt": "2025-11-23T06:15:30.000Z"
}
```

### POST /api/cast-vote

Cast a vote using a registered passport.

**Request Body:**
```json
{
  "passportHash": "0x3931e925acb...",
  "candidateId": 1,
  "reason": "Best policy" // optional
}
```

**Response:**
```json
{
  "success": true,
  "txHash": "0x134d0ff127fcd077...",
  "blockNumber": 60150,
  "candidate": "A",
  "explorerUrl": "https://devnet.aztecscan.xyz/tx/0x134d0ff127fcd077..."
}
```

### GET /api/results

Get current vote tallies.

**Response:**
```json
{
  "success": true,
  "results": {
    "candidateA": 10,
    "candidateB": 7,
    "candidateC": 3,
    "total": 20
  },
  "timestamp": "2025-11-23T06:20:00.000Z"
}
```

### GET /api/status

Check voting period status.

**Response:**
```json
{
  "success": true,
  "isActive": true,
  "startTime": 1700721527,
  "endTime": 1701326327,
  "currentTime": 1700900000,
  "startDate": "2025-11-23T06:08:47.000Z",
  "endDate": "2025-11-30T06:08:47.000Z"
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "nodeUrl": "https://devnet.aztec-labs.com/",
  "contractAddress": "0x0f3eeb4035bb83af82b66bc929512a64eaed1e53fff95a4ee2d407b7956ba226"
}
```

## Setup

### Install Dependencies

```bash
npm install
```

### Environment Variables

Create a `.env` file:

```bash
NODE_URL=https://devnet.aztec-labs.com/
PORT=3001
```

### Run Server

```bash
npm start
```

The server will start on `http://localhost:3001`.

## How It Works

### 1. Wallet Management

The server creates and caches a `TestWallet` connected to Aztec devnet:

```javascript
const wallet = await TestWallet.create(node);
```

This wallet is reused across requests to avoid creating new wallets for each vote.

### 2. Sponsored FPC Setup

The server registers the Sponsored FPC contract:

```javascript
const sponsoredFPCInstance = await getContractInstanceFromInstantiationParams(
  SponsoredFPCContract.artifact,
  { salt: SPONSORED_FPC_SALT }
);
```

This allows gasless transactions for voters.

### 3. Passport Registration (Simulated)

The `/api/register-passport` endpoint:

1. Validates age (must be 18+)
2. Generates deterministic passport_hash from passport data:
   ```javascript
   const passportData = `${passportNumber}|${nationality}|${dateOfBirth}|${name}`;
   const hash = createHash('sha256').update(passportData).digest('hex');
   const passportHash = '0x' + hash;
   ```
3. Returns passport_hash to client

**Note**: In production, this would verify a ZK proof from the `register_identity` circuit.

### 4. Vote Casting

The `/api/cast-vote` endpoint:

1. Loads contract instance from devnet
2. Converts passport_hash to Aztec Field element:
   ```javascript
   const nullifierField = Fr.fromString(passportHash);
   ```
3. Submits transaction with Sponsored FPC:
   ```javascript
   const tx = await contract.methods
     .cast_vote(candidateField, nullifierField, reasonField)
     .send({ fee: { paymentMethod: sponsoredPaymentMethod } });
   ```
4. Waits for confirmation and returns TX hash

### 5. Results & Status

- `/api/results`: Calls `contract.methods.get_vote(candidate).simulate()`
- `/api/status`: Calls `contract.methods.get_start_time().simulate()` and `get_end_time()`

## Testing

### Register a Passport

```bash
curl -X POST http://localhost:3001/api/register-passport \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alice Smith",
    "dateOfBirth": "1990-01-15",
    "nationality": "USA",
    "passportNumber": "US987654321"
  }'
```

### Cast a Vote

```bash
curl -X POST http://localhost:3001/api/cast-vote \
  -H "Content-Type: application/json" \
  -d '{
    "passportHash": "0x3931e925acb91221c2b162891c7cf52d34dd9eb503cf1992a788b004ff8d63f1",
    "candidateId": 1,
    "reason": "Great candidate"
  }'
```

### Get Results

```bash
curl http://localhost:3001/api/results
```

### Check Status

```bash
curl http://localhost:3001/api/status
```

## Error Handling

The API returns structured error responses:

```json
{
  "success": false,
  "error": "This passport has already voted! Sybil resistance active."
}
```

Common errors:
- `Missing required fields`: Request body incomplete
- `Must be 18 years or older`: Age verification failed
- `This passport has already voted`: Nullifier already used (sybil resistance)
- `Contract not found`: Invalid contract address

## Security Considerations

### Simulated vs Production

**Current (Demo)**:
- Passport_hash generated server-side from plaintext data
- Simple age check (no cryptographic proof)
- Suitable for hackathon testing

**Production**:
- Client generates ZK proof using `register_identity` circuit
- Server verifies proof on-chain with `std::verify_proof_with_type`
- No plaintext passport data ever leaves user's device
- Cryptographic age proofs instead of simple date comparison

### Privacy Guarantees

Even in demo mode:
- ✅ Passport_hash is deterministic (same passport = same hash)
- ✅ Sybil resistance works (nullifier tree prevents double voting)
- ✅ Vote choices are private (private execution on Aztec)
- ✅ Only tallies are public

## Dependencies

- `@aztec/aztec.js`: Aztec SDK for contract interactions
- `@aztec/test-wallet`: Server-side wallet for devnet
- `express`: Web framework
- `cors`: Cross-origin resource sharing

## License

MIT
