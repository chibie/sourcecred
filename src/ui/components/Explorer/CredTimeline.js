// @flow
import React from "react";
import {extent} from "d3-array";
import {scaleLinear} from "d3-scale";
import {line} from "d3-shape";

class CredTimeline extends React.Component<{|
  +data: $ReadOnlyArray<number> | null,
|}> {
  render() {
    const {data} = this.props;
    if (data == null) {
      return "";
    }

    const width = 300;
    const height = 25;

    const ext = extent(data);
    const xScale = scaleLinear().domain([0, data.length]).range([0, width]);
    const yScale = scaleLinear().domain(ext).range([height, 0]);
    const gen = line()
      .x((_, i) => xScale(i))
      .y((d) => yScale(d));

    return (
      <svg width={width} height={height}>
        <path d={gen(data)} stroke="blue" fill="none" stokewidth={1} />
      </svg>
    );
  }
}

export default CredTimeline;
