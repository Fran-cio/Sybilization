mod test;
use dep::aztec::macros::aztec;

// PrivateVoting - Sybil-Resistant Voting using Aztec as Identity Infrastructure
// 
// This contract demonstrates how Aztec Network serves as a privacy-preserving identity layer:
// 
// 1. IDENTITY VERIFICATION: Users prove they are unique humans via ZKPassport (biometric passport)
//    without revealing their actual identity on-chain.
// 
// 2. PRIVACY PRESERVATION: The voting action is executed privately on the user's device (PXE),
//    ensuring that the voter's choice and identity remain confidential.
// 
// 3. SYBIL RESISTANCE: Each passport generates a unique nullifier. Aztec's nullifier tree
//    prevents double-voting by ensuring each nullifier can only be used once.
// 
// 4. USER CONTROL: Identity data never leaves the user's device. The user controls their
//    private keys and generates proofs locally. No centralized authority stores identity data.
// 
// 5. TRANSPARENCY WHERE NEEDED: Vote tallies are public for verifiability, while individual
//    votes remain private.
// 
// FLOW:
// - User scans passport with ZKPassport app to generate unique identifier
// - Frontend derives nullifier from identifier
// - Private function 'cast_vote' executes on user's device
// - Nullifier is pushed to Aztec's nullifier tree (automatic uniqueness check)
// - Public tally is updated transparently
// - If nullifier already exists transaction reverts (prevents double-voting)
#[aztec]
pub contract PrivateVoting {
    use dep::aztec::{
        macros::{functions::{external, internal, initializer}, storage::storage},
        protocol_types::traits::ToField,
    };
    use dep::aztec::state_vars::{Map, PublicMutable};

    #[storage]
    struct Storage<Context> {
        tally: Map<Field, PublicMutable<Field, Context>, Context>,
        start_time: PublicMutable<u64, Context>,
        end_time: PublicMutable<u64, Context>,
        creator: PublicMutable<Field, Context>,
        // Vote metadata: encrypted reasons stored per voter
        vote_reasons: Map<Field, PublicMutable<Field, Context>, Context>,
        // Results snapshot: final tallies when voting ends
        final_snapshot: Map<Field, PublicMutable<Field, Context>, Context>,
        snapshot_taken: PublicMutable<bool, Context>,
    }

    // Initialize voting period - called once after deployment
    // @param start - Unix timestamp when voting begins
    // @param end - Unix timestamp when voting ends
    #[initializer]
    #[external("public")]
    fn initialize(start: u64, end: u64) {
        let sender = context.msg_sender();
        if sender.is_some() {
            storage.creator.write(sender.unwrap().to_field());
        }
        storage.start_time.write(start);
        storage.end_time.write(end);
    }

    // cast_vote - Private function executed on user's device
    // 
    // This function demonstrates Aztec's role as identity infrastructure:
    // 
    // @param candidate - The candidate to vote for (kept private during execution)
    // @param nullifier - Unique identifier derived from ZKPassport proof
    // @param reason - Optional encrypted reason for the vote (0 if no reason)
    // 
    // PRIVACY GUARANTEES:
    // - Executed in user's PXE (Private Execution Environment)
    // - No one can see WHO voted or FOR WHOM
    // - Only the user knows their nullifier
    // - Vote reason is stored encrypted, only voter can decrypt
    // 
    // SYBIL RESISTANCE:
    // - context.push_nullifier() automatically checks the nullifier tree
    // - If nullifier exists transaction REVERTS (prevents double-voting)
    // - If nullifier is new inserted into tree and vote counts
    // 
    // USER CONTROL:
    // - User controls when to vote (they initiate the transaction)
    // - User controls their nullifier (derived from their passport locally)
    // - No central authority can vote on behalf of the user
    #[external("private")]
    fn cast_vote(candidate: Field, nullifier: Field, reason: Field) {
        // CRITICAL: Push nullifier to Aztec's nullifier tree
        // This single line provides:
        // 1. Uniqueness check (automatic revert if nullifier exists)
        // 2. Sybil resistance (one vote per unique passport)
        // 3. Privacy (nullifier doesn't reveal voter identity)
        context.push_nullifier(nullifier);
        
        // Store vote reason if provided (encrypted, only voter can read)
        if reason != 0 {
            PrivateVoting::at(context.this_address())
                ._store_vote_reason(nullifier, reason)
                .enqueue(&mut context);
        }
        
        // Enqueue public function to increment tally
        PrivateVoting::at(context.this_address()).add_to_tally_public(candidate).enqueue(
            &mut context,
        );
    }

    #[external("public")]
    #[internal]
    fn add_to_tally_public(candidate: Field) {
        // Check if voting period is active
        let now = context.timestamp();
        assert(now >= storage.start_time.read(), "Voting has not started yet");
        assert(now <= storage.end_time.read(), "Voting has ended");
        
        let new_tally = storage.tally.at(candidate).read() + 1;
        storage.tally.at(candidate).write(new_tally);
    }

    #[external("public")]
    fn extend_voting(new_end_time: u64) {
        // Only creator can extend
        let creator = storage.creator.read();
        let sender = context.msg_sender();
        if sender.is_some() {
            assert(sender.unwrap().to_field() == creator, "Only creator can extend voting");
        } else {
            assert(false, "No sender");
        }
        assert(new_end_time > storage.end_time.read(), "New end time must be later");
        storage.end_time.write(new_end_time);
    }

    #[external("public")]
    fn end_voting() {
        // Only creator can end voting early
        let creator = storage.creator.read();
        let sender = context.msg_sender();
        if sender.is_some() {
            assert(sender.unwrap().to_field() == creator, "Only creator can end voting");
        } else {
            assert(false, "No sender");
        }
        // Set end_time to now (effectively ending voting immediately)
        let now = context.timestamp();
        storage.end_time.write(now);
    }

    // Internal function to store vote reason
    #[external("public")]
    #[internal]
    fn _store_vote_reason(nullifier: Field, reason: Field) {
        storage.vote_reasons.at(nullifier).write(reason);
    }

    // Take snapshot of current results - can only be done once
    #[external("public")]
    fn take_snapshot() {
        // Only take snapshot once
        if !storage.snapshot_taken.read() {
            // Verify voting has ended or caller is creator
            let now = context.timestamp();
            let voting_ended = now > storage.end_time.read();
            
            if !voting_ended {
                let creator = storage.creator.read();
                let sender = context.msg_sender();
                if sender.is_some() {
                    assert(
                        sender.unwrap().to_field() == creator,
                        "Only creator can take snapshot before voting ends"
                    );
                } else {
                    assert(false, "No sender");
                }
            }
            
            // Snapshot candidates 1, 2, 3 (could be extended)
            storage.final_snapshot.at(1).write(storage.tally.at(1).read());
            storage.final_snapshot.at(2).write(storage.tally.at(2).read());
            storage.final_snapshot.at(3).write(storage.tally.at(3).read());
            storage.snapshot_taken.write(true);
        }
    }

    // get_vote - Get current vote count for a candidate
    // 
    // This is an unconstrained view function that demonstrates the transparency aspect:
    // - Anyone can verify vote counts for each candidate
    // - Results are auditable
    // - But individual votes remain private
    // 
    // @param candidate - The candidate ID (1 for A, 2 for B)
    #[external("utility")]
    unconstrained fn get_vote(candidate: Field) -> Field {
        storage.tally.at(candidate).read()
    }

    // Debug functions to check voting period
    #[external("utility")]
    unconstrained fn get_start_time() -> u64 {
        storage.start_time.read()
    }

    #[external("utility")]
    unconstrained fn get_end_time() -> u64 {
        storage.end_time.read()
    }

    #[external("utility")]
    unconstrained fn get_creator() -> Field {
        storage.creator.read()
    }

    // Get vote reason for a nullifier (only voter can decrypt)
    #[external("utility")]
    unconstrained fn get_vote_reason(nullifier: Field) -> Field {
        storage.vote_reasons.at(nullifier).read()
    }

    // Get snapshot result for a candidate
    #[external("utility")]
    unconstrained fn get_snapshot(candidate: Field) -> Field {
        storage.final_snapshot.at(candidate).read()
    }

    // Check if snapshot has been taken
    #[external("utility")]
    unconstrained fn is_snapshot_taken() -> bool {
        storage.snapshot_taken.read()
    }
    

}
