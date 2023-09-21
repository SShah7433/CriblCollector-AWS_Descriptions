/* eslint-disable no-await-in-loop */
exports.name = "AWS Descriptions";
exports.version = "0.1";
exports.disabled = false;
exports.destroyable = false;

const { Readable, Transform } = require("stream");
const logger = C.util.getLogger("aws-description-collector");

const { STSClient, AssumeRoleCommand } = require("./node_modules/@aws-sdk/client-sts")

const {
  CloudFrontClient,
  paginateListDistributions,
} = require("./node_modules/@aws-sdk/client-cloudfront");

const {
  EC2Client,
  DescribeAddressesCommand,
  DescribeKeyPairsCommand,
  DescribeRegionsCommand,
  DescribeReservedInstancesCommand,
  paginateDescribeImages,
  paginateDescribeInstances,
  paginateDescribeNetworkAcls,
  paginateDescribeSecurityGroups,
  paginateDescribeSnapshots,
  paginateDescribeSubnets,
  paginateDescribeVolumes,
  paginateDescribeVpcs
} = require("./node_modules/@aws-sdk/client-ec2");

// imports prepended with ELB to indicate v1
const {
  ElasticLoadBalancingClient: ELB_ElasticLoadBalancingClient,
  DescribeInstanceHealthCommand: ELB_DescribeInstanceHealthCommand,
  DescribeTagsCommand: ELB_DescribeTagsCommand,
  paginateDescribeLoadBalancers: ELB_paginateDescribeLoadBalancers,
} = require("./node_modules/@aws-sdk/client-elastic-load-balancing");

// imports prepended with ELBv2 to indicate v2
const {
  ElasticLoadBalancingV2Client: ELBv2_ElasticLoadBalancingClient,
  DescribeTagsCommand: ELBv2_DescribeTagsCommand,
  DescribeTargetHealthCommand: ELBv2_DescribeTargetHealthCommand,
  paginateDescribeListeners: ELBv2_paginateDescribeListeners,
  paginateDescribeLoadBalancers: ELBv2_paginateDescribeLoadBalancers,
  paginateDescribeTargetGroups: ELBv2_paginateDescribeTargetGroups
} = require("./node_modules/@aws-sdk/client-elastic-load-balancing-v2");

const {
  IAMClient,
  paginateListAttachedUserPolicies,
  paginateListGroups,
  paginateListPolicies,
  paginateListRoles,
  paginateListUsers
} = require("./node_modules/@aws-sdk/client-iam");

const {
  LambdaClient,
  paginateListFunctions,
} = require("./node_modules/@aws-sdk/client-lambda");

const {
  RDSClient,
  paginateDescribeDBInstances,
  paginateDescribeReservedDBInstances,
} = require("./node_modules/@aws-sdk/client-rds");

const {
  S3Client,
  ListBucketsCommand
} = require("./node_modules/@aws-sdk/client-s3")

let batchSize;
let regions;
let endpoints;

let awsAuthenticationMethod;
let enableAssumeRole;

let awsApiKey;
let awsSecretKey;
let awsSessionToken;
let assumeRoleArn;
let assumeRoleExternalId;
let assumeRoleDurationSeconds;

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
  batchSize = conf.batchSize || 100;
  awsAuthenticationMethod = conf.awsAuthenticationMethod || "auto";
  enableAssumeRole = conf.enableAssumeRole || false;
  
  awsApiKey = conf.awsApiKey || "";
  awsSecretKey = conf.awsSecretKey || "";

  assumeRoleArn = conf.assumeRoleArn || "";
  assumeRoleExternalId = conf.assumeRoleExternalId || "";
  assumeRoleDurationSeconds = conf.assumeRoleDurationSeconds || 900;

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

  var clientConfig = { region: collectible.region }
  var commandConfig = {};
  var paginatorConfig = { pageSize: batchSize };

  var client = null;
  var command = null;
  var paginator = null;

  // Authentication

  // Get access key and secret key
  if (awsAuthenticationMethod === "auto") {
    if (enableAssumeRole === true) {
      client = new STSClient(clientConfig);
      command = new AssumeRoleCommand({
        RoleArn: assumeRoleArn,
        RoleSessionName: "cribl_collector_aws_descriptions",
        ExternalId: assumeRoleExternalId,
        DurationSeconds: 900
      });

      const authResponse = await client.send(command);
      awsApiKey = authResponse.Credentials.AccessKeyId;
      awsSecretKey = authResponse.Credentials.SecretAccessKey;
      awsSessionToken = authResponse.Credentials.SessionToken;
    }
  }

  // Add credentials to client configuration if needed
  if (awsAuthenticationMethod !== "auto" || enableAssumeRole === true) {
    const awsCredentials = {
      accessKeyId: awsApiKey,
      secretAccessKey: awsSecretKey,
      ...(awsSessionToken) && {sessionToken : awsSessionToken}  // Set sessionToken only if it exists
    };
    Object.assign(clientConfig, {credentials: awsCredentials})
  }

  // Setup collection based on endpoint
  switch (collectible.endpoint) {
    case "cloudfront_listDistributions":
      Object.assign(paginatorConfig, {client: new CloudFrontClient(clientConfig)});
      paginator = paginateListDistributions(paginatorConfig, commandConfig);
      break;
    case "ec2_describeAddresses":
      client = new EC2Client(clientConfig)
      command = new DescribeAddressesCommand(commandConfig);
      break;
    case "ec2_describeImages":
      Object.assign(paginatorConfig, {client: new EC2Client(clientConfig)});
      paginator = paginateDescribeImages(paginatorConfig, commandConfig);
      break;
    case "ec2_describeInstances":
      Object.assign(paginatorConfig, {client: new EC2Client(clientConfig)});
      paginator = paginateDescribeInstances(paginatorConfig, commandConfig);
      break;
    case "ec2_describeKeyPairs":
      client = new EC2Client(clientConfig);
      command = new DescribeKeyPairsCommand(commandConfig);
      break;
    case "ec2_describeNetworkAcls":
      Object.assign(paginatorConfig, {client: new EC2Client(clientConfig)});
      paginator = paginateDescribeNetworkAcls(paginatorConfig, commandConfig);
      break;
    case "ec2_describeRegions":
      client = new EC2Client(clientConfig);
      command = new DescribeRegionsCommand(commandConfig);
      break;
    case "ec2_describeReservedInstances":
      client = new EC2Client(clientConfig)
      command = new DescribeReservedInstancesCommand(commandConfig);
      break;
    case "ec2_describeSecurityGroups":
      Object.assign(paginatorConfig, {client: new EC2Client(clientConfig)});
      paginator = paginateDescribeSecurityGroups(paginatorConfig, commandConfig);
      break;
    case "ec2_describeSnapshots":
      Object.assign(paginatorConfig, {client: new EC2Client(clientConfig)});
      paginator = paginateDescribeSnapshots(paginatorConfig, commandConfig);
      break;
    case "ec2_describeSubnets":
      Object.assign(paginatorConfig, {client: new EC2Client(clientConfig)});
      paginator = paginateDescribeSubnets(paginatorConfig, commandConfig)
      break;
    case "ec2_describeVolumes":
      Object.assign(paginatorConfig, {client: new EC2Client(clientConfig)});
      paginator = paginateDescribeVolumes(paginatorConfig, commandConfig);
      break;
    case "ec2_describeVpcs":
      Object.assign(paginatorConfig, {client: new EC2Client(clientConfig)});
      paginator = paginateDescribeVpcs(paginatorConfig, commandConfig)
      break;
    case "elb_describeInstanceHealth":
      client = new ELB_ElasticLoadBalancingClient(clientConfig);
      command = new ELB_DescribeInstanceHealthCommand(commandConfig);
      break;
    case "elb_describeLoadBalancers":
      Object.assign(paginatorConfig, {client: new ELB_ElasticLoadBalancingClient(clientConfig)});
      paginator = ELB_paginateDescribeLoadBalancers(paginatorConfig, commandConfig);
      break;
    case "elb_describeTags":
      client = new ELB_ElasticLoadBalancingClient(clientConfig);
      command = new ELB_DescribeTagsCommand(commandConfig);
      break;
    case "elbv2_describeListeners":
      Object.assign(paginatorConfig, {client: new ELBv2_ElasticLoadBalancingClient(clientConfig)});
      paginator = ELBv2_paginateDescribeListeners(paginatorConfig, commandConfig);
      break;
    case "elbv2_describeLoadBalancers":
      Object.assign(paginatorConfig, {client: new ELBv2_ElasticLoadBalancingClient(clientConfig)});
      paginator = ELBv2_paginateDescribeLoadBalancers(paginatorConfig, commandConfig);
      break;
    case "elbv2_describeTags":
      client = new ELBv2_ElasticLoadBalancingClient(clientConfig);
      command = new ELBv2_DescribeTagsCommand(commandConfig)
      break;
    case "elbv2_describeTargetGroups":
      Object.assign(paginatorConfig, {client: new ELBv2_ElasticLoadBalancingClient(clientConfig)});
      paginator = ELBv2_paginateDescribeTargetGroups(paginatorConfig, commandConfig);
      break;
    case "elbv2_describeTargetHealth":
      client = new ELBv2_ElasticLoadBalancingClient(clientConfig);
      command = new ELBv2_DescribeTargetHealthCommand(commandConfig);
      break;
    case "iam_listAttachedUserPolicies":
      Object.assign(paginatorConfig, {client: new IAMClient(clientConfig)});
      paginator = paginateListAttachedUserPolicies(paginatorConfig, commandConfig);
      break;
    case "iam_listGroups":
      Object.assign(paginatorConfig, {client: new IAMClient(clientConfig)});
      paginator = paginateListGroups(paginatorConfig, commandConfig);
      break;
    case "iam_listPolicies":
      Object.assign(paginatorConfig, {client: new IAMClient(clientConfig)});
      paginator = paginateListPolicies(paginatorConfig, commandConfig);
      break;
    case "iam_listRoles":
      Object.assign(paginatorConfig, {client: new IAMClient(clientConfig)});
      paginator = paginateListRoles(paginatorConfig, commandConfig);
      break;
    case "iam_listUsers":
      Object.assign(paginatorConfig, {client: new IAMClient(clientConfig)});
      paginator = paginateListUsers(paginatorConfig, commandConfig);
      break;
    case "lambda_listFunctions":
      Object.assign(paginatorConfig, {client: new LambdaClient(clientConfig)});
      paginator = paginateListFunctions(paginatorConfig, commandConfig);
      break;
    case "rds_describeDbInstances":
      Object.assign(paginatorConfig, {client: new RDSClient(clientConfig)});
      paginator = paginateDescribeDBInstances(paginatorConfig, commandConfig);
      break;
    case "rds_describeReservedDbInstances":
      Object.assign(paginatorConfig, {client: new RDSClient(clientConfig)});
      paginator = paginateDescribeReservedDBInstances(paginatorConfig, commandConfig);
      break;
    case "s3_listBuckets":
      client = new S3Client(clientConfig);
      command = ListBucketsCommand(commandConfig);
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
