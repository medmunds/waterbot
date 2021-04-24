import {BigQuery} from '@google-cloud/bigquery';
import {projectId} from './config';


export const bigquery = new BigQuery({
  projectId: projectId,
});
