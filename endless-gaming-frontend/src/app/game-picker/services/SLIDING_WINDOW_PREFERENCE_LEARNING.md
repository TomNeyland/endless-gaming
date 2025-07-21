# Sliding Window Preference Learning Architecture

## Overview

The preference learning system uses **exponential decay-based sliding window** to emphasize recent user choices while maintaining historical context. This enables dynamic preference evolution during infinite voting sessions.

## Core Concept

Instead of treating all votes equally, the system applies **gradual decay** to older preferences, ensuring recent choices have more influence on the ML model while preserving long-term preference stability.

## Technical Implementation

### Decay-Based Sliding Window

```typescript
// On each new vote:
1. Apply decay to ALL existing weights (0.88-0.95 multiplier)
2. Apply full SGD update for the new vote (learning rate 0.1)
3. Result: Recent votes maintain full strength, older votes gradually fade
```

### Decay Factors by Vote History

- **Early voting (≤5 votes)**: 0.95 decay - Very light decay to build initial preferences
- **Medium voting (6-20 votes)**: 0.92 decay - Light decay for stable learning
- **Many votes (20+ votes)**: 0.88 decay - Moderate decay for sliding window effect

### Mathematical Properties

- **Recent 5 votes**: Maintain ~85-100% of original influence
- **Medium-term votes**: Gradually decay to ~60-80% influence over time
- **Historical votes**: Smoothly fade to ~10-30% influence but never disappear
- **Memory span**: Effective preference memory of ~15-25 votes depending on decay rate

## Benefits Over Previous Approach

### ✅ **Stability**
- No more weight vector rebuilding (O(1) vs O(n) per vote)
- No complex window calculations that could fail
- Eliminates preference summary disappearing bug

### ✅ **Smoothness**
- Gradual preference transition instead of discrete window jumps
- More natural human-like memory decay
- No artificial boundaries between time windows

### ✅ **Performance**
- Incremental updates instead of full rebuilds
- Constant time complexity per vote
- Memory efficient (no need to store complex window state)

### ✅ **Infinite Voting Ready**
- Scales naturally to hundreds or thousands of votes
- Recent preferences always dominate without manual tuning
- No risk of ancient votes overwhelming current taste

## Implementation Details

### PreferenceService Key Methods

```typescript
updatePreferences(winner, loser) {
  // 1. Apply decay to existing weights
  this.applySlidingWindowDecay();
  
  // 2. Calculate SGD for new vote
  const gradient = this.calculateGradient(winner, loser);
  
  // 3. Apply full-strength update
  this.updateWeights(gradient * this.learningRate);
}

applySlidingWindowDecay() {
  const decayFactor = this.calculateDecayFactor(); // 0.88-0.95
  this.weightVector *= decayFactor; // Element-wise multiplication
}
```

### Confidence Calculation Integration

The confidence system now emphasizes **recent preference consistency**:
- 40% recent prediction accuracy (last 10 votes)
- 25% weight vector magnitude
- 20% comparison count (recent data prioritized)
- 15% weight concentration

## Example Preference Evolution

```
Vote 1: User likes "Action" → Weight = 0.1
Vote 2: Decay (0.95) + new preference → Action weight = 0.095 + new_learning
Vote 3: Decay (0.95) + new preference → Action weight = ~0.09 + accumulated_learning
Vote 20: Action weight = original_strength * (0.92^19) + accumulated_updates
```

## Debugging & Monitoring

### Debug Logging Output
```typescript
🔍 Preference Debug [Vote 5]: {
  hasPreferences: true,
  weightMagnitude: "0.245",
  nonZeroWeights: 142,
  significantWeights: 8,
  likedTags: 3,
  dislikedTags: 2,
  maxWeight: "0.0847",
  minSignificantWeight: "0.0103"
}
```

### Key Metrics to Monitor
- **weightMagnitude**: Overall strength of preferences (should grow with votes)
- **significantWeights**: Number of weights above 0.01 threshold
- **hasPreferences**: Whether preference summary is visible to user
- **maxWeight**: Strongest individual preference strength

## Why This Approach Works

### Psychological Accuracy
Human preferences naturally fade over time - we don't remember our first choice as strongly as our most recent one. Exponential decay mirrors this natural process.

### Mathematical Elegance
Exponential decay is used throughout ML (momentum in optimizers, recency bias in recommendations) because it's mathematically clean and practically effective.

### Infinite Voting Compatibility
Unlike discrete time windows, exponential decay naturally handles any number of votes without manual parameter tuning or edge cases.

## Future Enhancements

### Adaptive Decay Rates
Could adjust decay based on:
- Model confidence (stronger decay when confident)
- Preference consistency (less decay for stable preferences)  
- User engagement patterns (faster decay for rapid voters)

### Multi-Timescale Learning
Could implement multiple decay rates:
- Fast decay for style preferences (graphics, genre)
- Slow decay for core preferences (violence, complexity)

### Confidence-Weighted Decay
Apply stronger decay to votes the model was uncertain about, preserving high-confidence historical preferences longer.

---

*This system successfully combines the sophistication of sliding window preference learning with the stability and performance needed for infinite voting scenarios.*