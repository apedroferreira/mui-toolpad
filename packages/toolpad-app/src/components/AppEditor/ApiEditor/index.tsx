import * as React from 'react';
import { useQuery } from 'react-query';
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  Stack,
  Toolbar,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import { useParams } from 'react-router-dom';
import SplitPane from 'react-split-pane';
import { NodeId } from '../../../types';
import dataSources from '../../../toolpadDataSources/client';
import client from '../../../api';
import * as appDom from '../../../appDom';
import { useDom, useDomApi } from '../../DomLoader';
import useDebounced from '../../../utils/useDebounced';
import NodeNameEditor from '../NodeNameEditor';
import NotFoundEditor from '../NotFoundEditor';
import { ConnectionSelect } from '../HierarchyExplorer/CreateApiNodeDialog';
import JsonView from '../../JsonView';
import { usePrompt } from '../../../utils/router';
import useShortcut from '../../../utils/useShortcut';
import { JsExpressionEditor } from '../PageEditor/JsExpressionEditor';

interface ApiEditorContentProps<Q> {
  appId: string;
  className?: string;
  apiNode: appDom.ApiNode<Q>;
}

function ApiEditorContent<Q, PQ>({ appId, className, apiNode }: ApiEditorContentProps<Q>) {
  const domApi = useDomApi();
  const dom = useDom();

  const [apiQuery, setApiQuery] = React.useState<Q>(apiNode.attributes.query.value);
  const savedQuery = React.useRef(apiNode.attributes.query.value);

  const [transformEnabled, setTransformEnabled] = React.useState<boolean>(
    apiNode.attributes.transformEnabled?.value ?? false,
  );
  const savedTransformEnabled = React.useRef(apiNode.attributes.transformEnabled?.value);

  const [transform, setTransform] = React.useState<string>(
    apiNode.attributes.transform?.value ?? '(data) => { return data }',
  );
  const savedTransform = React.useRef(apiNode.attributes.transform?.value);

  const conectionId = apiNode.attributes.connectionId.value as NodeId;
  const connection = appDom.getMaybeNode(dom, conectionId, 'connection');
  const dataSourceName = apiNode.attributes.dataSource.value;
  const dataSource = dataSources[dataSourceName] || null;

  const previewApi: appDom.ApiNode<Q> = React.useMemo(() => {
    return {
      ...apiNode,
      attributes: {
        ...apiNode.attributes,
        query: appDom.createConst(apiQuery),
        transformEnabled: appDom.createConst(transformEnabled),
        transform: appDom.createConst(transform),
      },
    };
  }, [apiNode, apiQuery, transformEnabled, transform]);

  const debouncedPreviewApi = useDebounced(previewApi, 250);

  const previewQuery = useQuery(['api', debouncedPreviewApi], async () =>
    client.query.execApi(appId, debouncedPreviewApi, {}),
  );

  const queryEditorApi = React.useMemo(() => {
    return {
      fetchPrivate: async (query: PQ | {}) =>
        client.query.dataSourceFetchPrivate(appId, conectionId, query),
    };
  }, [appId, conectionId]);

  const handleConnectionChange = React.useCallback(
    (newConnectionId) => {
      if (apiNode) {
        domApi.setNodeNamespacedProp(
          apiNode,
          'attributes',
          'connectionId',
          appDom.createConst(newConnectionId),
        );
      }
    },
    [apiNode, domApi],
  );

  const handleTransformFnChange = React.useCallback((newValue: string) => {
    setTransform(newValue);
  }, []);

  const handleTransformEnabledChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setTransformEnabled(event.target.checked);
    },
    [],
  );

  const handleSave = React.useCallback(() => {
    (Object.keys(apiQuery) as (keyof Q)[]).forEach((propName) => {
      if (typeof propName !== 'string' || !apiQuery[propName]) {
        return;
      }
      domApi.setNodeNamespacedProp(apiNode, 'attributes', 'query', appDom.createConst(apiQuery));
      domApi.setNodeNamespacedProp(
        apiNode,
        'attributes',
        'transform',
        appDom.createConst(transform),
      );
      domApi.setNodeNamespacedProp(
        apiNode,
        'attributes',
        'transformEnabled',
        appDom.createConst(transformEnabled),
      );
    });
    savedQuery.current = apiQuery;
    savedTransform.current = transform;
    savedTransformEnabled.current = transformEnabled;
  }, [apiNode, apiQuery, domApi, transform, transformEnabled]);

  useShortcut({ code: 'KeyS', metaKey: true }, handleSave);

  const allChangesAreCommitted =
    savedQuery.current === apiQuery &&
    savedTransformEnabled.current === transformEnabled &&
    savedTransform.current === transform;

  usePrompt(
    'Your API has unsaved changes. Are you sure you want to navigate away? All changes will be discarded.',
    !allChangesAreCommitted,
  );

  if (!dataSource) {
    return (
      <NotFoundEditor className={className} message={`DataSource "${dataSourceName}" not found`} />
    );
  }

  const previewIsInvalid: boolean = !connection && !previewQuery.isError;

  return (
    <Box sx={{ width: '100%', height: '100%' }}>
      <SplitPane
        split="horizontal"
        allowResize
        defaultSize="60%"
        paneStyle={{
          width: '100%',
          overflowY: 'auto',
          display: 'block',
        }}
      >
        <Stack sx={{ width: '100%', p: 3 }}>
          <Stack direction="row" gap={2}>
            <NodeNameEditor node={apiNode} />
            <ConnectionSelect
              dataSource={dataSourceName}
              value={connection?.id ?? null}
              onChange={handleConnectionChange}
            />
          </Stack>
          <Toolbar disableGutters>
            <Button onClick={handleSave} disabled={allChangesAreCommitted}>
              Update
            </Button>
          </Toolbar>
          <Stack spacing={2}>
            <dataSource.QueryEditor
              api={queryEditorApi}
              // TODO: Add disabled mode to QueryEditor
              // disabled={!connection}
              value={apiQuery}
              onChange={(newApiQuery) => setApiQuery(newApiQuery)}
              globalScope={{}}
            />
            <Stack>
              <FormControlLabel
                label="Transform API response"
                control={
                  <Checkbox
                    size="small"
                    checked={transformEnabled}
                    onChange={handleTransformEnabledChange}
                    inputProps={{ 'aria-label': 'controlled' }}
                  />
                }
              />
            </Stack>
            {transformEnabled ? (
              <JsExpressionEditor
                globalScope={{}}
                value={transform}
                onChange={handleTransformFnChange}
              />
            ) : null}
          </Stack>
        </Stack>
        {previewQuery.isLoading || (previewIsInvalid && previewQuery.isFetching) ? (
          <LinearProgress />
        ) : null}
        <Box sx={{ p: 2 }}>
          {previewQuery.isError ? (
            <Alert severity="error">{(previewQuery.error as Error).message}</Alert>
          ) : null}
          {!previewIsInvalid && previewQuery.isSuccess ? (
            <JsonView src={previewQuery.data} />
          ) : null}
        </Box>
      </SplitPane>
    </Box>
  );
}

interface ApiEditorProps {
  appId: string;
}

export default function ApiEditor({ appId }: ApiEditorProps) {
  const dom = useDom();
  const { nodeId } = useParams();
  const apiNode = appDom.getMaybeNode(dom, nodeId as NodeId, 'api');
  return apiNode ? (
    <ApiEditorContent key={nodeId} appId={appId} apiNode={apiNode} />
  ) : (
    <NotFoundEditor message={`Non-existing api "${nodeId}"`} />
  );
}
