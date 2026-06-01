// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MantSentSignalLedger {
    event PolicyCommitted(
        uint256 indexed agentId,
        bytes32 indexed policyHash,
        address indexed watchedWallet,
        uint256 timestamp
    );

    event AlertCommitted(
        uint256 indexed agentId,
        bytes32 indexed alertHash,
        address indexed watchedWallet,
        bytes32 evidenceTxHash,
        uint8 severity,
        uint256 timestamp
    );

    event OutcomeRecorded(
        uint256 indexed agentId,
        bytes32 indexed alertHash,
        uint8 outcome,
        bytes32 feedbackHash,
        uint256 timestamp
    );

    function commitPolicy(uint256 agentId, bytes32 policyHash, address watchedWallet) external {
        emit PolicyCommitted(agentId, policyHash, watchedWallet, block.timestamp);
    }

    function commitAlert(
        uint256 agentId,
        bytes32 alertHash,
        address watchedWallet,
        bytes32 evidenceTxHash,
        uint8 severity
    ) external {
        emit AlertCommitted(agentId, alertHash, watchedWallet, evidenceTxHash, severity, block.timestamp);
    }

    function recordOutcome(uint256 agentId, bytes32 alertHash, uint8 outcome, bytes32 feedbackHash) external {
        emit OutcomeRecorded(agentId, alertHash, outcome, feedbackHash, block.timestamp);
    }
}
