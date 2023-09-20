/* eslint-disable no-await-in-loop */
exports.name = "AWS Descriptions";
exports.version = "0.1";
exports.disabled = false;
exports.destroyable = false;

const { Readable, Transform } = require("stream");
const logger = C.util.getLogger("test-collector");

const {
  CloudFrontClient,
  paginateListDistributions,
} = require("./node_modules/@aws-sdk/client-cloudfront");

const {
  ElasticLoadBalancingClient,
  paginateDescribeLoadBalancers,
} = require("./node_modules/@aws-sdk/client-elastic-load-balancing");

const {
  EC2Client,

  DescribeAddressesCommand,
  DescribeKeyPairsCommand,
  DescribeReservedInstancesCommand,

  paginateDescribeImages,
  paginateDescribeInstances,
  paginateDescribeSecurityGroups,
  paginateDescribeSnapshots,
  paginateDescribeVolumes,
} = require("./node_modules/@aws-sdk/client-ec2");

const {
  LambdaClient,
  paginateListFunctions,
} = require("./node_modules/@aws-sdk/client-lambda");

const {
  RDSClient,
  paginateDescribeDBInstances,
  paginateDescribeReservedDBInstances,
} = require("./node_modules/@aws-sdk/client-rds");

let batch_size;
let regions;
let endpoints;

exports.init = async (opts) => {
  logger.info("init called", { opts, discoverData: opts.conf.discoverData });
  const conf = opts.conf;
  discoverItems = (conf.discoverData || ["default"]).map((i) => {
    return { item: i };
  });
  collectData = conf.collectData || "Default Collect Data";
  logger.info("init done", { discoverItems, collectData });

  regions = conf.regions || [];
  endpoints = conf.endpoints || [];
  batch_size = conf.batch_size || 25;
};

// Return discoverItems from init, each item will result in a collect task.
exports.discover = async (job) => {
  regions.forEach((region) => {
    endpoints.forEach((endpoint) => {
      job.addResult({
        region: region,
        endpoint: endpoint,
      });
    });
  });
};

//AWS SDK V3
exports.collect = async (collectible, job) => {
  class JSONStringifyStream extends Transform {
    constructor(options) {
      super({ objectMode: true });
    }

    _transform(chunk, enc, next) {
      this.push(JSON.stringify(chunk));
      next();
    }
  }

  var paginatorConfig = null;
  var commandParams = null;
  var paginator = null;

  var client = null;
  var command = null;

  switch (collectible.endpoint) {
    case "cloudfront_listDistributions":
      paginatorConfig = {
        client: new CloudFrontClient({ region: collectible.region }),
        pageSize: batch_size,
      };
      commandParams = {};
      paginator = paginateListDistributions(paginatorConfig, commandParams);
      break;
    case "ec2_describeAddresses":
      commandParams = {};
      client = new EC2Client({ region: collectible.region })
      command = new DescribeAddressesCommand(commandParams);
      break;
    case "ec2_describeImages":
      paginatorConfig = {
        client: new EC2Client({ region: collectible.region }),
        pageSize: batch_size,
      };
      commandParams = {};
      paginator = paginateDescribeImages(paginatorConfig, commandParams);
      break;
    case "ec2_describeInstances":
      paginatorConfig = {
        client: new EC2Client({ region: collectible.region }),
        pageSize: batch_size,
      };
      commandParams = {};
      paginator = paginateDescribeInstances(paginatorConfig, commandParams);
      break;
    case "ec2_describeKeyPairs":
      commandParams = {};
      client = new EC2Client({ region: collectible.region })
      command = new DescribeKeyPairsCommand(commandParams);
      break;
    case "ec2_describeReservedInstances":
      commandParams = {};
      client = new EC2Client({ region: collectible.region })
      command = new DescribeReservedInstancesCommand(commandParams);
      break;
    case "ec2_describeSecurityGroups":
      paginatorConfig = {
        client: new EC2Client({ region: collectible.region }),
        pageSize: batch_size,
      };
      commandParams = {};
      paginator = paginateDescribeSecurityGroups(
        paginatorConfig,
        commandParams
      );
      break;
    case "ec2_describeSnapshots":
      paginatorConfig = {
        client: new EC2Client({ region: collectible.region }),
        pageSize: batch_size,
      };
      commandParams = {};
      paginator = paginateDescribeSnapshots(paginatorConfig, commandParams);
      break;
    case "ec2_describeVolumes":
      paginatorConfig = {
        client: new EC2Client({ region: collectible.region }),
        pageSize: batch_size,
      };
      commandParams = {};
      paginator = paginateDescribeVolumes(paginatorConfig, commandParams);
      break;
    case "elb_describeLoadBalancers":
      paginatorConfig = {
        client: new ElasticLoadBalancingClient({ region: collectible.region }),
        pageSize: batch_size,
      };
      commandParams = {};
      paginator = paginateDescribeLoadBalancers(paginatorConfig, commandParams);
      break;
    case "lambda_listFunctions":
      paginatorConfig = {
        client: new LambdaClient({ region: collectible.region }),
        pageSize: batch_size,
      };
      commandParams = {};
      paginator = paginateListFunctions(paginatorConfig, commandParams);
      break;
    case "rds_describeDbInstances":
      paginatorConfig = {
        client: new RDSClient({ region: collectible.region }),
        pageSize: batch_size,
      };
      commandParams = {};
      paginator = paginateDescribeDBInstances(paginatorConfig, commandParams);
      break;
    case "rds_describeReservedDbInstances":
      paginatorConfig = {
        client: new RDSClient({ region: collectible.region }),
        pageSize: batch_size,
      };
      commandParams = {};
      paginator = paginateDescribeReservedDBInstances(
        paginatorConfig,
        commandParams
      );
      break;
  }

  // Using pagination (recommended)
  if (paginator !== null) {
    const stringify = new JSONStringifyStream();
    const rs = new Readable.from(paginator).pipe(stringify);
    return Promise.resolve(rs);
  } else {  // Endpoints that do not support pagination
    const response = await client.send(command);
    const rs = new Readable();
    rs.push(JSON.stringify(response))
    rs.push(null)
    return Promise.resolve(rs)
  }
};
