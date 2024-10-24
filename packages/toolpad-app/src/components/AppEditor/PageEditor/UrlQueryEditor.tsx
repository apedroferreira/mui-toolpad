import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import * as React from 'react';
import AddIcon from '@mui/icons-material/Add';
import StringRecordEditor from '../../StringRecordEditor';
import * as appDom from '../../../appDom';
import { useDom, useDomApi } from '../../DomLoader';
import { NodeId } from '../../../types';

export interface UrlQueryEditorProps {
  pageNodeId: NodeId;
}

export default function UrlQueryEditor({ pageNodeId }: UrlQueryEditorProps) {
  const dom = useDom();
  const domApi = useDomApi();

  const page = appDom.getNode(dom, pageNodeId, 'page');

  const [dialogOpen, setDialogOpen] = React.useState(false);

  const [input, setInput] = React.useState(page.attributes.urlQuery.value || {});
  React.useEffect(
    () => setInput(page.attributes.urlQuery.value || {}),
    [page.attributes.urlQuery.value],
  );

  const handleSave = React.useCallback(() => {
    domApi.setNodeNamespacedProp(page, 'attributes', 'urlQuery', appDom.createConst(input));
  }, [domApi, page, input]);

  return (
    <React.Fragment>
      <Button color="inherit" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
        URL query
      </Button>
      <Dialog fullWidth open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogTitle>Edit URL query</DialogTitle>
        <DialogContent>
          <StringRecordEditor
            sx={{ my: 1 }}
            fieldLabel="Parameter"
            valueLabel="Default value"
            value={input}
            onChange={setInput}
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button color="inherit" variant="text" onClick={() => setDialogOpen(false)}>
            Close
          </Button>
          <Button disabled={page.attributes.urlQuery.value === input} onClick={handleSave}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </React.Fragment>
  );
}
