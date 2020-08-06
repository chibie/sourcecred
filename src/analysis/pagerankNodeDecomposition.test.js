// @flow

import {Graph, NodeAddress, edgeToStrings} from "../core/graph";
import {
  distributionToNodeDistribution,
  createConnections,
  createOrderedSparseMarkovChain,
} from "../core/algorithm/graphToMarkovChain";
import {
  findStationaryDistribution,
  type PagerankParams,
} from "../core/algorithm/markovChain";
import {uniformDistribution} from "../core/algorithm/distribution";
import {
  decompose,
  type PagerankNodeDecomposition,
} from "./pagerankNodeDecomposition";
import * as MapUtil from "../util/map";
import * as N from "../util/numerics";

import {advancedGraph, node, edge} from "../core/graphTestUtil";

/**
 * Format a decomposition to be shown in a snapshot. This converts
 * addresses and edges to strings to avoid NUL characters.
 */
function formatDecomposition(d: PagerankNodeDecomposition) {
  return MapUtil.mapEntries(d, (key, {score, scoredConnections}) => [
    NodeAddress.toString(key),
    {
      score,
      scoredConnections: scoredConnections.map(
        ({connection, source, connectionScore}) => ({
          connection: {
            adjacency: formatAdjacency(connection.adjacency),
            weight: connection.weight,
          },
          source: NodeAddress.toString(source),
          connectionScore,
        })
      ),
    },
  ]);
  function formatAdjacency(adjacency) {
    switch (adjacency.type) {
      case "SYNTHETIC_LOOP":
        return {type: "SYNTHETIC_LOOP"};
      case "IN_EDGE":
        return {type: "IN_EDGE", edge: edgeToStrings(adjacency.edge)};
      case "OUT_EDGE":
        return {type: "OUT_EDGE", edge: edgeToStrings(adjacency.edge)};
      default:
        throw new Error((adjacency.type: empty));
    }
  }
}

/**
 * Perform basic sanity checks on a decomposition. This ensures that
 * every node's score is the sum of its connections' scores, that the
 * scores of the decomposition sum to 1, and that each node's
 * connections are listed in non-increasing order of score.
 */
function validateDecomposition(decomposition) {
  const epsilon = 1e-6;

  // Check that each node's score is the sum of its subscores.
  for (const [key, {score, scoredConnections}] of decomposition.entries()) {
    const totalSubscore = scoredConnections
      .map((sc) => sc.connectionScore)
      .reduce((a, b) => a + b, 0);
    const delta = totalSubscore - score;
    if (Math.abs(delta) > epsilon) {
      const message = [
        `for node ${NodeAddress.toString(key)}: `,
        `expected total score (${score}) to equal `,
        `sum of connection scores (${totalSubscore}) `,
        `within ${epsilon}, but the difference is ${delta}`,
      ].join("");
      throw new Error(message);
    }
  }

  // Check that the total score is 1.
  {
    const totalScore = Array.from(decomposition.values())
      .map((node) => node.score)
      .reduce((a, b) => a + b, 0);
    const delta = totalScore - 1;
    if (Math.abs(delta) > epsilon) {
      const message = [
        `expected total score of all nodes (${totalScore}) to equal 1.0 `,
        `within ${epsilon}, but the difference is ${delta}`,
      ].join("");
      throw new Error(message);
    }
  }

  // Check that each node's connections are in score-descending order.
  for (const {scoredConnections} of decomposition.values()) {
    scoredConnections.forEach((current, index) => {
      if (index === 0) {
        return;
      }
      const previous = scoredConnections[index - 1];
      if (current.connectionScore > previous.connectionScore) {
        const message = [
          `expected connection score to be non-increasing, but `,
          `element at index ${index} has score ${current.connectionScore}, `,
          `higher than that of its predecessor (${previous.connectionScore})`,
        ].join("");
        throw new Error(message);
      }
    });
  }
}

describe("analysis/pagerankNodeDecomposition", () => {
  describe("decompose", () => {
    it("has the expected output on a simple asymmetric chain", async () => {
      const n1 = node("n1");
      const n2 = node("n2");
      const n3 = node("sink");
      const e1 = edge("e1", n1, n2);
      const e2 = edge("e2", n2, n3);
      const e3 = edge("e3", n1, n3);
      const e4 = edge("e4", n3, n3);
      const g = new Graph()
        .addNode(n1)
        .addNode(n2)
        .addNode(n3)
        .addEdge(e1)
        .addEdge(e2)
        .addEdge(e3)
        .addEdge(e4);
      const edgeWeight = () => ({forwards: 6.0, backwards: 3.0});
      const connections = createConnections(g, edgeWeight, 1.0);
      const osmc = createOrderedSparseMarkovChain(connections);
      const params: PagerankParams = {
        chain: osmc.chain,
        alpha: N.proportion(0),
        seed: uniformDistribution(osmc.chain.length),
        pi0: uniformDistribution(osmc.chain.length),
      };
      const distributionResult = await findStationaryDistribution(params, {
        verbose: false,
        convergenceThreshold: N.finiteNonnegative(1e-6),
        maxIterations: N.nonnegativeInteger(255),
        yieldAfterMs: N.finiteNonnegative(1),
      });
      const pr = distributionToNodeDistribution(
        osmc.nodeOrder,
        distributionResult.pi
      );
      const decomposition = decompose(pr, connections);
      expect(formatDecomposition(decomposition)).toMatchSnapshot();
      validateDecomposition(decomposition);
    });

    it("is valid on the example graph", async () => {
      const g = advancedGraph().graph1();
      const edgeWeight = () => ({forwards: 6.0, backwards: 3.0});
      const connections = createConnections(g, edgeWeight, 1.0);
      const osmc = createOrderedSparseMarkovChain(connections);
      const params: PagerankParams = {
        chain: osmc.chain,
        alpha: N.proportion(0),
        seed: uniformDistribution(osmc.chain.length),
        pi0: uniformDistribution(osmc.chain.length),
      };
      const distributionResult = await findStationaryDistribution(params, {
        verbose: false,
        convergenceThreshold: N.finiteNonnegative(1e-6),
        maxIterations: N.nonnegativeInteger(255),
        yieldAfterMs: N.finiteNonnegative(1),
      });
      const pr = distributionToNodeDistribution(
        osmc.nodeOrder,
        distributionResult.pi
      );
      const decomposition = decompose(pr, connections);
      validateDecomposition(decomposition);
    });
  });
});
