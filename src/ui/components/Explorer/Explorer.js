// @flow
import React from "react";
import {
  Button,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Menu,
  MenuItem,
  ListItem,
  ListItemText,
  List,
  Divider,
} from "@material-ui/core";
import KeyboardArrowDownIcon from "@material-ui/icons/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@material-ui/icons/KeyboardArrowUp";
import deepEqual from "lodash.isequal";
import {format} from "d3-format";
import {sum} from "d3-array";
import {CredView} from "../../../analysis/credView";
import sortBy from "../../../util/sortBy";
import {type NodeAddressT} from "../../../core/graph";
import {type PluginDeclaration} from "../../../analysis/pluginDeclaration";
import {type Weights, copy as weightsCopy} from "../../../core/weights";
import {WeightConfig} from "../../weights/WeightConfig";
import {WeightsFileManager} from "../../weights/WeightsFileManager";
import {type TimelineCredParameters} from "../../../analysis/timeline/params";

import NodeRow from "./NodeRow";

export type ExplorerProps = {|
  +initialView: CredView,
|};

export type ExplorerState = {|
  // Whether to filter down to a particular type prefix.
  // If unset, shows all user-typed nodes
  filter: NodeAddressT | null,
  weights: Weights,
  params: TimelineCredParameters,
  showWeightConfig: boolean,
  view: CredView,
  recalculating: boolean,
  anchorEl: HTMLElement | null,
  name: string | null,
|};

export class Explorer extends React.Component<ExplorerProps, ExplorerState> {
  constructor(props: ExplorerProps) {
    super(props);
    const view = props.initialView;
    this.state = {
      view,
      filter: null,
      weights: weightsCopy(view.weights()),
      params: {...view.params()},
      showWeightConfig: false,
      recalculating: false,
      anchorEl: null,
      name: null,
    };
  }

  handleMenuClose = () => {
    this.setState({
      anchorEl: null,
    });
  };

  // Renders the dropdown that lets the user select a type
  renderFilterSelect() {
    const plugins = this.state.view.plugins();
    const optionGroup = (declaration: PluginDeclaration) => {
      const header = (
        <MenuItem
          key={declaration.nodePrefix}
          value={declaration.nodePrefix}
          style={{fontWeight: "bold"}}
          onClick={() =>
            this.setState({
              anchorEl: null,
              filter: declaration.nodePrefix,
              name: declaration.name,
            })
          }
        >
          {declaration.name}
        </MenuItem>
      );
      const entries = declaration.nodeTypes.map((type, index) => (
        <MenuItem
          key={index}
          value={type.prefix}
          onClick={() =>
            this.setState({
              anchorEl: null,
              filter: type.prefix,
              name: type.name,
            })
          }
        >
          {"\u2003" + type.name}
        </MenuItem>
      ));
      return [header, ...entries];
    };
    return (
      <>
        <List component="div" aria-label="Device settings">
          <ListItem
            button
            aria-haspopup="true"
            aria-controls="filter-menu"
            aria-label="filters"
            onClick={(event) =>
              this.setState({
                anchorEl: event.currentTarget,
              })
            }
          >
            <ListItemText
              primary={
                this.state.name ? `Filter: ${this.state.name}` : "Filter"
              }
            />
            {this.state.anchorEl ? (
              <KeyboardArrowUpIcon />
            ) : (
              <KeyboardArrowDownIcon />
            )}
          </ListItem>
          <Divider style={{backgroundColor: "#F20057", height: "2px"}} />
        </List>

        <Menu
          id="lock-menu"
          anchorEl={this.state.anchorEl}
          keepMounted
          open={Boolean(this.state.anchorEl)}
          onClose={this.handleMenuClose}
          getContentAnchorEl={null}
          anchorOrigin={{vertical: "bottom", horizontal: "left"}}
          transformOrigin={{vertical: "top", horizontal: "left"}}
        >
          <MenuItem
            key={"All users"}
            value={""}
            style={{fontWeight: "bold"}}
            onClick={() =>
              this.setState({
                anchorEl: null,
                filter: null,
                name: "All users",
              })
            }
          >
            All users
          </MenuItem>
          {plugins.map(optionGroup)}
        </Menu>
      </>
    );
  }

  renderConfigurationRow() {
    const {showWeightConfig, view, params, weights} = this.state;
    const weightFileManager = (
      <WeightsFileManager
        weights={weights}
        onWeightsChange={(weights: Weights) => {
          this.setState({weights});
        }}
      />
    );
    const weightConfig = (
      <WeightConfig
        declarations={view.plugins()}
        nodeWeights={weights.nodeWeights}
        edgeWeights={weights.edgeWeights}
        onNodeWeightChange={(prefix, weight) => {
          this.setState(({weights}) => {
            weights.nodeWeights.set(prefix, weight);
            return {weights};
          });
        }}
        onEdgeWeightChange={(prefix, weight) => {
          this.setState(({weights}) => {
            weights.edgeWeights.set(prefix, weight);
            return {weights};
          });
        }}
      />
    );

    const alphaSlider = (
      <input
        type="range"
        min={0.05}
        max={0.95}
        step={0.05}
        value={params.alpha}
        onChange={(e) => {
          const newParams = {
            ...params,
            alpha: e.target.valueAsNumber,
          };
          this.setState({params: newParams});
        }}
      />
    );
    const paramsUpToDate =
      deepEqual(params, view.params()) && deepEqual(weights, view.weights());
    const analyzeButton = (
      <Grid container item xs>
        <Button
          variant="contained"
          color="primary"
          disabled={this.state.recalculating || paramsUpToDate}
          onClick={() => this.analyzeCred()}
        >
          re-compute cred
        </Button>
      </Grid>
    );
    return (
      <Grid container>
        <Grid
          container
          direction="row"
          justify="space-between"
          alignItems="center"
          style={{marginTop: 30}}
        >
          <Grid container item xs>
            {this.renderFilterSelect()}
          </Grid>
          <Grid container item xs>
            <Button
              variant="contained"
              color="primary"
              onClick={() => {
                this.setState(({showWeightConfig}) => ({
                  showWeightConfig: !showWeightConfig,
                }));
              }}
            >
              {showWeightConfig
                ? "Hide weight configuration"
                : "Show weight configuration"}
            </Button>
          </Grid>
          {analyzeButton}
        </Grid>
        {showWeightConfig && (
          <div style={{marginTop: 10}}>
            <span>Upload/Download weights:</span>
            {weightFileManager}
            <span>α</span>
            {alphaSlider}
            <span>{format(".2f")(this.state.params.alpha)}</span>
            {weightConfig}
          </div>
        )}
      </Grid>
    );
  }

  async analyzeCred() {
    this.setState({recalculating: true});
    const view = await this.state.view.recompute(
      this.state.weights,
      this.state.params
    );
    this.setState({view, recalculating: false});
  }

  render() {
    const {filter, view, recalculating, name} = this.state;
    const nodes =
      filter == null ? view.userNodes() : view.nodes({prefix: filter});
    // TODO: Allow sorting/displaying only recent cred...
    const sortedNodes = sortBy(nodes, (n) => -n.credSummary.cred);
    const total = sum(nodes.map((n) => n.credSummary.cred));
    return (
      <div
        style={{
          width: "80%",
          margin: "0 auto",
          background: "white",
          padding: "0 5em 5em",
        }}
      >
        {this.renderConfigurationRow()}
        {recalculating ? <h1>Recalculating...</h1> : ""}
        <Table
          style={{
            width: "100%",
            tableLayout: "fixed",
            margin: "0 auto",
            padding: "20px 10px",
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell align="left" style={{color: "black"}}>
                {name ? name : "All users"}
              </TableCell>
              <TableCell align="right" style={{width: "10%", color: "black"}}>
                Cred
              </TableCell>
              <TableCell align="right" style={{width: "10%", color: "black"}}>
                % Total
              </TableCell>
              <TableCell
                align="right"
                style={{width: "30%", color: "black"}}
              ></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedNodes.slice(0, 200).map((node) => (
              <NodeRow
                depth={0}
                key={node.address}
                node={node}
                view={view}
                total={total}
                // We only show the cred charts for users, because in CredRank we might not have
                // cred-over-time data available for non-users.
                // Would rather not add a feature that we may later need to remove.
                showChart={filter == null}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }
}
