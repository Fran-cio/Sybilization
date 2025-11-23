import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { TestWallet } from '@aztec/test-wallet/server';
import { Contract } from '@aztec/aztec.js/contracts';
import { Fr, GrumpkinScalar } from '@aztec/aztec.js/fields';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee/testing';
import { SponsoredFPCContract } from '@aztec/noir-contracts.js/SponsoredFPC';
import { getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import { loadContractArtifact } from '@aztec/aztec.js/abi';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NODE_URL = process.env.NODE_URL || 'https://devnet.aztec-labs.com/';
const SPONSORED_FPC_SALT = new Fr(0);

async function main() {
  console.log(`Connecting to Aztec Devnet at ${NODE_URL}...`);
  const node = createAztecNodeClient(NODE_URL);
  
  console.log('Creating wallet (local PXE)...');
  const testWallet = await TestWallet.create(node);
  
  console.log('💰 Setting up Sponsored FPC...');
  const sponsoredFPCInstance = await getContractInstanceFromInstantiationParams(
    SponsoredFPCContract.artifact,
    { salt: SPONSORED_FPC_SALT }
  );
  console.log(`💰 Sponsored FPC address: ${sponsoredFPCInstance.address}`);

  await testWallet.registerContract({
    instance: sponsoredFPCInstance,
    artifact: SponsoredFPCContract.artifact
  });
  
  const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(
    sponsoredFPCInstance.address
  );
  
  console.log('👤 Creating Schnorr account...');
  const secretKey = Fr.random();
  const signingKey = GrumpkinScalar.random();
  const salt = Fr.random();
  
  const account = await testWallet.createSchnorrAccount(secretKey, salt, signingKey);
  const deployerAddress = account.address;
  console.log(`Using account: ${deployerAddress.toString()}`);
  
  const deployMethod = await account.getDeployMethod();
  console.log('📝 Deploying account with sponsored fees...');
  try {
      const tx = await deployMethod.send({ 
        from: AztecAddress.ZERO,
        fee: { paymentMethod: sponsoredPaymentMethod }
      }).wait();
      console.log(`✓ Account deployed (tx: ${tx.txHash})`);
  } catch (e) {
      console.error("Error deploying account:", e);
      throw e;
  }
  
  // Load contract artifact
  const artifactPath = path.join(__dirname, '../contracts/target/private_voting-PrivateVoting.json');
  const artifact = loadContractArtifact(JSON.parse(fs.readFileSync(artifactPath, 'utf8')));
  
  console.log('Deploying PrivateVoting contract to Devnet...');
  console.log('Note: This may take ~36 seconds due to Devnet block times');
  console.log(`Constructor args: [] (no constructor)`);
  
  try {
    // Use the correct Contract.deploy pattern with empty args (no constructor)
    const deploymentTx = Contract.deploy(testWallet, artifact, [])
      .send({
        from: deployerAddress,
        fee: {
          paymentMethod: sponsoredPaymentMethod
        }
      });
    
    const txHash = await deploymentTx.getTxHash();
    console.log(`📝 Deployment transaction sent: ${txHash}`);
    
    const receipt = await deploymentTx.wait({ timeout: 120000 });
    console.log(`⛏️ Transaction mined in block ${receipt.blockNumber}`);
    
    const contract = await deploymentTx.deployed();
    console.log(`✅ Contract deployed at: ${contract.address.toString()}`);
    
    // Save contract address for frontend
    const addressFile = path.join(__dirname, '../frontend/public/contract-address.json');
    fs.writeFileSync(addressFile, JSON.stringify({
      address: contract.address.toString(),
      deployedAt: new Date().toISOString(),
      network: 'devnet',
      nodeUrl: NODE_URL,
      adminAddress: deployerAddress.toString(),
      txHash: txHash.toString()
    }, null, 2));
    
    console.log(`Contract address saved to ${addressFile}`);
    console.log(`\n🔍 View on explorer: https://devnet-explorer.aztec.network/`);
  } catch (error) {
    console.error('❌ Deployment error:', error);
    if (error.message) {
      console.error('Error message:', error.message);
    }
    throw error;
  }
}

main().catch(console.error);
