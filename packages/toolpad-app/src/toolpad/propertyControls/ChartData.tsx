import * as React from 'react';
import {
  Box,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Popover,
  Stack,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import type { ChartDataSeries } from '@mui/toolpad-components';
import { useBrowserJsRuntime } from '@mui/toolpad-core/jsBrowserRuntime';
import DeleteIcon from '@mui/icons-material/Delete';
import { BindableAttrValue } from '@mui/toolpad-core';
import * as appDom from '../../appDom';
import type { EditorProps } from '../../types';
import PropertyControl from '../../components/PropertyControl';
import { usePageEditorState } from '../AppEditor/PageEditor/PageEditorProvider';
import { useDom, useDomApi } from '../AppState';

// eslint-disable-next-line import/no-cycle
import BindableEditor from '../AppEditor/PageEditor/BindableEditor';

function getDataSeriesProp(dataId: string): string {
  return `data.${dataId}`;
}

function ChartDataPropEditor({
  nodeId,
  propType,
  value = [],
  onChange,
}: EditorProps<(Omit<ChartDataSeries, 'data'> & { dataId?: string })[]>) {
  const { dom } = useDom();
  const domApi = useDomApi();
  const { pageState, globalScopeMeta } = usePageEditorState();
  const jsBrowserRuntime = useBrowserJsRuntime();

  const node = nodeId ? (appDom.getMaybeNode(dom, nodeId) as appDom.ElementNode) : null;

  const [dataSeriesEditIndex, setDataSeriesEditIndex] = React.useState<number | null>(null);
  const [popoverAnchorElement, setPopoverAnchorElement] = React.useState<HTMLElement | null>(null);

  const handleAddDataSeries = React.useCallback(() => {
    onChange([
      ...value,
      {
        kind: 'line',
        label: `dataSeries${value.length}`,
        xKey: 'x',
        yKey: 'y',
      },
    ]);
  }, [onChange, value]);

  const handleDataSeriesClick = React.useCallback(
    (index: number) => (event: React.MouseEvent<HTMLElement>) => {
      setDataSeriesEditIndex(index);
      setPopoverAnchorElement(event.currentTarget);
    },
    [],
  );

  const handleRemoveDataSeries = React.useCallback(
    (index: number) => () => {
      const { dataId } = value[index];

      if (node && dataId) {
        domApi.update((draft) =>
          appDom.setNodeNamespacedProp(draft, node, 'props', getDataSeriesProp(dataId), undefined),
        );
      }

      onChange([...value.slice(0, index), ...value.slice(index + 1)]);
    },
    [domApi, node, onChange, value],
  );

  const popoverId = React.useId();
  const isPopoverOpen = Boolean(popoverAnchorElement);

  const handlePopoverClose = React.useCallback(() => {
    setPopoverAnchorElement(null);
  }, []);

  const handleDataSeriesDataChange = React.useCallback(
    (index: number) => (newValue: BindableAttrValue<ChartDataSeries['data']> | null) => {
      const existingDataId = value[index].dataId;

      const dataId = existingDataId || appDom.createId();

      if (node) {
        domApi.update((draft) =>
          appDom.setNodeNamespacedProp(draft, node, 'props', `data.${dataId}`, newValue),
        );
      }

      if (!existingDataId) {
        onChange([
          ...value.slice(0, index),
          { ...value[index], dataId },
          ...value.slice(index + 1),
        ]);
      }
    },
    [domApi, node, onChange, value],
  );

  const editDataSeries = dataSeriesEditIndex !== null ? value[dataSeriesEditIndex] : null;

  if (!node) {
    return null;
  }

  return (
    <React.Fragment>
      <PropertyControl propType={propType}>
        <Box>
          <List sx={{ mb: 1 }}>
            {value.map((dataSeries, index) => {
              const { label } = dataSeries;

              return (
                <ListItem key={`${label}-${index}`} disableGutters>
                  <ListItemButton
                    onClick={handleDataSeriesClick(index)}
                    aria-describedby={popoverId}
                  >
                    <ListItemText primary={label} />
                  </ListItemButton>
                  <IconButton
                    aria-label="Delete data series"
                    onClick={handleRemoveDataSeries(index)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </ListItem>
              );
            })}
          </List>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            fullWidth
            onClick={handleAddDataSeries}
          >
            Add data series
          </Button>
        </Box>
      </PropertyControl>
      <Popover
        id={popoverId}
        open={isPopoverOpen}
        anchorEl={popoverAnchorElement}
        onClose={handlePopoverClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
      >
        {editDataSeries && dataSeriesEditIndex !== null ? (
          <Box sx={{ minWidth: 300, p: 2 }}>
            <Typography variant="body1" sx={{ mb: 1 }}>
              {editDataSeries.label}
            </Typography>
            <Stack gap={1} py={1}>
              <BindableEditor
                globalScope={pageState}
                globalScopeMeta={globalScopeMeta}
                label="data"
                jsRuntime={jsBrowserRuntime}
                propType={{ type: 'array' }}
                value={
                  (node?.props && node.props[getDataSeriesProp(editDataSeries.dataId || '')]) ??
                  null
                }
                onChange={handleDataSeriesDataChange(dataSeriesEditIndex)}
              />
            </Stack>
          </Box>
        ) : null}
      </Popover>
    </React.Fragment>
  );
}

export default ChartDataPropEditor;
