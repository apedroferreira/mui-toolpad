import type express from 'express';
import { RemoveLastParameter } from '@mui/toolpad-utils/types';
import { createMethod, MethodResolvers } from './rpc';
import type { ToolpadProject } from './localMode';

// Methods exposed to the Toolpad runtime
export function createRpcServer(project: ToolpadProject) {
  return {
    introspectDataProvider: createMethod<typeof project.functionsManager.introspectDataProvider>(
      ({ params }) => {
        return project.functionsManager.introspectDataProvider(...params);
      },
    ),
    getDataProviderRecords: createMethod<typeof project.functionsManager.getDataProviderRecords>(
      ({ params }) => {
        return project.functionsManager.getDataProviderRecords(...params);
      },
    ),
    deleteDataProviderRecord: createMethod<
      typeof project.functionsManager.deleteDataProviderRecord
    >(({ params }) => {
      return project.functionsManager.deleteDataProviderRecord(...params);
    }),
    updateDataProviderRecord: createMethod<
      typeof project.functionsManager.updateDataProviderRecord
    >(({ params }) => {
      return project.functionsManager.updateDataProviderRecord(...params);
    }),
    createDataProviderRecord: createMethod<
      typeof project.functionsManager.createDataProviderRecord
    >(({ params }) => {
      return project.functionsManager.createDataProviderRecord(...params);
    }),
    execQuery: createMethod<RemoveLastParameter<typeof project.dataManager.execQuery>>(
      ({ params, req }) => {
        return project.dataManager.execQuery(...params, req as express.Request);
      },
    ),
    execFunction: createMethod<typeof project.functionsManager.execFunction>(({ params }) => {
      return project.functionsManager.execFunction(...params);
    }),
  } satisfies MethodResolvers;
}

export type ServerDefinition = ReturnType<typeof createRpcServer>;
