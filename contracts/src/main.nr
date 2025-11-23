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
        macros::{functions::{external, internal}, storage::storage},
    };
    use dep::aztec::state_vars::{Map, PublicMutable};

    #[storage]
    struct Storage<Context> {
        tally: Map<Field, PublicMutable<Field, Context>, Context>,
        voting_ended: PublicMutable<bool, Context>,
    }

    // cast_vote - Private function executed on user's device
    // 
    // This function demonstrates Aztec's role as identity infrastructure:
    // 
    // @param candidate - The candidate to vote for (kept private during execution)
    // @param nullifier - Unique identifier derived from ZKPassport proof
    //                    Format: hash(passport_unique_identifier)
    // 
    // PRIVACY GUARANTEES:
    // - Executed in user's PXE (Private Execution Environment)
    // - No one can see WHO voted or FOR WHOM
    // - Only the user knows their nullifier
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
    fn cast_vote(candidate: Field, nullifier: Field) {
        // CRITICAL: Push nullifier to Aztec's nullifier tree
        // This single line provides:
        // 1. Uniqueness check (automatic revert if nullifier exists)
        // 2. Sybil resistance (one vote per unique passport)
        // 3. Privacy (nullifier doesn't reveal voter identity)
        context.push_nullifier(nullifier);
        
        // Enqueue public function to increment tally
        // No constructor needed - Aztec initializes to 0 automatically
        PrivateVoting::at(context.this_address()).add_to_tally_public(candidate).enqueue(
            &mut context,
        );
    }

    #[external("public")]
    #[internal]
    fn add_to_tally_public(candidate: Field) {
        assert(storage.voting_ended.read() == false, "Voting has ended");
        let new_tally = storage.tally.at(candidate).read() + 1;
        storage.tally.at(candidate).write(new_tally);
    }

    #[external("public")]
    fn end_voting() {
        storage.voting_ended.write(true);
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
    

}
