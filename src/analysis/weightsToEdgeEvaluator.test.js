// @flow

import {NodeAddress, EdgeAddress} from "../core/graph";
import {type Weights as WeightsT} from "../core/weights";
import * as Weights from "../core/weights";
import {weightsToEdgeEvaluator} from "./weightsToEdgeEvaluator";
import * as N from "../util/numerics";

describe("analysis/weightsToEdgeEvaluator", () => {
  const src = NodeAddress.fromParts(["src"]);
  const dst = NodeAddress.fromParts(["dst"]);
  const edge = {
    src,
    dst,
    address: EdgeAddress.fromParts(["edge"]),
    timestampMs: 0,
  };

  function evaluateEdge(weights: WeightsT) {
    const evaluator = weightsToEdgeEvaluator(weights);
    return evaluator(edge);
  }

  it("applies default weights when none are specified", () => {
    expect(evaluateEdge(Weights.empty())).toEqual({forwards: 1, backwards: 1});
  });

  it("matches all prefixes of the nodes in scope", () => {
    const weights = Weights.empty();
    weights.nodeWeights.set(NodeAddress.empty, N.finiteNonnegative(99));
    expect(evaluateEdge(weights)).toEqual({
      forwards: N.finiteNonnegative(99),
      backwards: N.finiteNonnegative(99),
    });
  });

  it("an explicit weight on a prefix overrides the type weight", () => {
    const weights = Weights.empty();
    weights.nodeWeights.set(src, N.finiteNonnegative(1));
    expect(evaluateEdge(weights)).toEqual({
      forwards: N.finiteNonnegative(1),
      backwards: N.finiteNonnegative(1),
    });
  });

  it("uses 1 as a default weight for unmatched nodes and edges", () => {
    const evaluator = weightsToEdgeEvaluator(Weights.empty());
    expect(evaluator(edge)).toEqual({
      forwards: N.finiteNonnegative(1),
      backwards: N.finiteNonnegative(1),
    });
  });

  it("ignores extra weights if they do not apply", () => {
    const withoutExtraWeights = evaluateEdge(Weights.empty());
    const extraWeights = Weights.empty();
    extraWeights.nodeWeights.set(
      NodeAddress.fromParts(["foo"]),
      N.finiteNonnegative(99)
    );
    extraWeights.nodeWeights.set(
      NodeAddress.fromParts(["foo"]),
      N.finiteNonnegative(99)
    );
    extraWeights.edgeWeights.set(EdgeAddress.fromParts(["foo"]), {
      forwards: N.finiteNonnegative(14),
      backwards: N.finiteNonnegative(19),
    });
    const withExtraWeights = evaluateEdge(extraWeights);
    expect(withoutExtraWeights).toEqual(withExtraWeights);
  });
});
