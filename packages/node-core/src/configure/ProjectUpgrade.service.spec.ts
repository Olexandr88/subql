// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0

import {Sequelize} from '@subql/x-sequelize';
import {CacheMetadataModel, ISubqueryProject} from '../indexer';
import {IProjectUpgradeService, ProjectUpgradeSevice, upgradableSubqueryProject} from './ProjectUpgrade.service';
import {SchemaMigrationService} from './SchemaMigration.service';

const templateProject = {
  network: {
    chainId: '1',
  },
  dataSources: [{startBlock: 1}],
};

const demoProjects = [
  {
    ...templateProject,
  },
  {
    parent: {
      block: 10,
      reference: '0',
    },
    ...templateProject,
  },
  {
    parent: {
      block: 20,
      reference: '1',
    },
    ...templateProject,
  },
  {
    parent: {
      block: 30,
      reference: '2',
    },
    ...templateProject,
  },
  {
    parent: {
      block: 40,
      reference: '3',
    },
    ...templateProject,
  },
  {
    parent: {
      block: 50,
      reference: '4',
    },
    ...templateProject,
  },
] as ISubqueryProject[];

const loopProjects = [
  {
    parent: {
      block: 10,
      reference: '1',
    },
    ...templateProject,
  },
  {
    parent: {
      block: 20,
      reference: '0',
    },
    ...templateProject,
  },
] as ISubqueryProject[];

const futureProjects = [
  {
    ...templateProject,
  },
  {
    parent: {
      block: 30,
      reference: '0',
    },
    ...templateProject,
  },
  {
    parent: {
      block: 20,
      reference: '1',
    },
    ...templateProject,
  },
] as ISubqueryProject[];

const mockMetadata = () => {
  let deployments = {};

  return {
    find: jest.fn(() => JSON.stringify(deployments)),
    set: jest.fn((_, value) => (deployments = JSON.parse(value))),
  } as any as CacheMetadataModel;
};
const mockSchemaMigrationService = new SchemaMigrationService({} as Sequelize);

describe('Project Upgrades', () => {
  describe('Loading projects', () => {
    it('can load a project with no parents', async () => {
      const upgradeService = await ProjectUpgradeSevice.create(
        demoProjects[0],
        (id) => Promise.resolve(demoProjects[parseInt(id, 10)]),
        mockSchemaMigrationService,
        1
      );

      expect([...upgradeService.projects.keys()]).toEqual([1]);
    });

    it('can load all parent projects', async () => {
      const upgradeService = await ProjectUpgradeSevice.create(
        demoProjects[5],
        (id) => Promise.resolve(demoProjects[parseInt(id, 10)]),
        mockSchemaMigrationService,
        1
      );

      expect([...upgradeService.projects.keys()]).toEqual([1, 10, 20, 30, 40, 50]);
    });

    it('can handle projects that somehow refer to each other', async () => {
      await expect(
        ProjectUpgradeSevice.create(
          loopProjects[1],
          (id) => Promise.resolve(loopProjects[parseInt(id, 10)]),
          mockSchemaMigrationService,
          1
        )
      ).rejects.toThrow();
    });

    it('can load all parent projects upto startHeight', async () => {
      const upgradeService = await ProjectUpgradeSevice.create(
        demoProjects[5],
        (id) => Promise.resolve(demoProjects[parseInt(id, 10)]),
        mockSchemaMigrationService,
        21
      );

      expect([...upgradeService.projects.keys()]).toEqual([20, 30, 40, 50]);
    });

    it('can load all parent projects upto and including startHeight', async () => {
      const upgradeService = await ProjectUpgradeSevice.create(
        demoProjects[5],
        (id) => Promise.resolve(demoProjects[parseInt(id, 10)]),
        mockSchemaMigrationService,
        20
      );

      expect([...upgradeService.projects.keys()]).toEqual([20, 30, 40, 50]);
    });

    it('will throw if parent projects are not at an earlier height', async () => {
      await expect(
        ProjectUpgradeSevice.create(
          futureProjects[2],
          (id) => Promise.resolve(futureProjects[parseInt(id, 10)]),
          mockSchemaMigrationService,
          1
        )
      ).rejects.toThrow();
    });

    it('will throw if there are no parents and earlier start height', async () => {
      const project = {
        dataSources: [{startBlock: 20}],
      } as ISubqueryProject;
      await expect(
        ProjectUpgradeSevice.create(
          project,
          (id) => Promise.resolve(futureProjects[parseInt(id, 10)]),
          mockSchemaMigrationService,
          1
        )
      ).rejects.toThrow();
    });

    it('will validate all parents are for the same network', async () => {
      const projects = [
        {
          ...templateProject,
          network: {chainId: 2},
        },
        {
          parent: {
            block: 30,
            reference: '0',
          },
          ...templateProject,
        },
      ] as ISubqueryProject[];

      await expect(
        ProjectUpgradeSevice.create(
          projects[1],
          (id) => Promise.resolve(projects[parseInt(id, 10)]),
          mockSchemaMigrationService,
          1
        )
      ).rejects.toThrow();
    });

    it('will validate all parents are for the same node runner', async () => {
      const projects = [
        {
          ...templateProject,
          runner: {
            node: {
              name: 'subql-node-wrong',
            },
          },
        },
        {
          parent: {
            block: 30,
            reference: '0',
          },
          ...templateProject,
        },
      ] as ISubqueryProject[];

      await expect(
        ProjectUpgradeSevice.create(
          projects[1],
          (id) => Promise.resolve(projects[parseInt(id, 10)]),
          mockSchemaMigrationService,
          1
        )
      ).rejects.toThrow();
    });
  });

  describe('Getting projects for heights', () => {
    let upgradeService: ProjectUpgradeSevice<ISubqueryProject>;

    beforeAll(async () => {
      upgradeService = await ProjectUpgradeSevice.create(
        demoProjects[5],
        (id) => Promise.resolve(demoProjects[parseInt(id, 10)]),
        mockSchemaMigrationService,
        1
      );
    });

    it('can get the latest project', () => {
      expect(upgradeService.getProject(100).parent?.block).toEqual(50);
    });

    it('gets the right project with an exact match', () => {
      expect(upgradeService.getProject(30).parent?.block).toEqual(30);
    });

    it('throws an error before the first project start height', () => {
      expect(() => upgradeService.getProject(-1)).toThrow();
    });
  });

  describe('Upgradable subquery project', () => {
    let upgradeService: ProjectUpgradeSevice<ISubqueryProject>;
    let project: ISubqueryProject & IProjectUpgradeService<ISubqueryProject>;

    beforeEach(async () => {
      upgradeService = await ProjectUpgradeSevice.create(
        demoProjects[5],
        (id) => Promise.resolve(demoProjects[parseInt(id, 10)]),
        mockSchemaMigrationService,
        1
      );

      await upgradeService.init(mockMetadata());

      project = upgradableSubqueryProject(upgradeService);
    });

    it('cant set values other than `currentHeight`', () => {
      expect(() => ((project as any).id = 'not possible')).toThrow();
    });

    it('can set the current height on the service', async () => {
      await upgradeService.setCurrentHeight(20);

      expect(upgradeService.currentHeight).toEqual(20);
      expect(project.currentHeight).toEqual(20);
    });

    it('can set the current height on the project', async () => {
      await project.setCurrentHeight(20);

      expect(upgradeService.currentHeight).toEqual(20);
      expect(project.currentHeight).toEqual(20);
    });

    it('the project is the right project for a set height', async () => {
      await project.setCurrentHeight(25);

      expect(project.parent?.block).toEqual(20);
    });

    it('can update the indexed deployments', async () => {
      await upgradeService.updateIndexedDeployments('A', 1);

      expect(await (upgradeService as any).getDeploymentsMetadata()).toEqual({1: 'A'});

      // Only update if the deployment changes
      await upgradeService.updateIndexedDeployments('B', 2);
      await upgradeService.updateIndexedDeployments('B', 3);

      expect(await (upgradeService as any).getDeploymentsMetadata()).toEqual({1: 'A', 2: 'B'});

      // Handle fork
      await upgradeService.updateIndexedDeployments('C', 10);
      await upgradeService.updateIndexedDeployments('D', 7);

      expect(await (upgradeService as any).getDeploymentsMetadata()).toEqual({1: 'A', 2: 'B', 7: 'D'});
    });
  });

  describe('Upgrade metadata validation', () => {
    let upgradeService: ProjectUpgradeSevice<ISubqueryProject>;

    beforeEach(async () => {
      upgradeService = await ProjectUpgradeSevice.create(
        {...demoProjects[5], id: '5'},
        (id) => Promise.resolve({...demoProjects[parseInt(id, 10)], id}),
        mockSchemaMigrationService,
        1
      );
    });

    it('succeds with an exact match', () => {
      const indexedData = {1: '0', 10: '1', 20: '2', 30: '3', 40: '4', 50: '5'};
      expect(upgradeService.validateIndexedData(indexedData)).toEqual(undefined);
    });

    it('succeds with a partial match', () => {
      const indexedData = {1: '0', 10: '1', 20: '2'};
      expect(upgradeService.validateIndexedData(indexedData)).toEqual(29);
    });

    it('succeeds with no indexed data', () => {
      expect(upgradeService.validateIndexedData({})).toEqual(undefined);
    });

    it('succeeds with upgraded projects before the upgraded feature', () => {
      // Negative values wouldn't be possible in use, but its here for test simplification
      const indexedData = {[-20]: '-2', [-10]: '-1', 1: '0', 10: '1', 20: '2', 30: '3', 40: '4', 50: '5'};
      expect(upgradeService.validateIndexedData(indexedData)).toEqual(undefined);
    });

    it('can rewind if an upgrade needs replacing', () => {
      // indexed a -> b -> c -> d
      // upgrade to a -> b -> c -> e

      const indexedData = {1: '0', 10: '1', 20: '2', 30: '3', 40: '4', 50: 'Z'};
      expect(upgradeService.validateIndexedData(indexedData)).toEqual(49);
    });

    it('throws if there are no matching projects', () => {
      // indexed a -> b -> c -> d
      // upgrade to x -> y -> z
      const indexedData = {1: 'A', 11: 'B', 21: 'C'};
      expect(() => upgradeService.validateIndexedData(indexedData)).toThrow();
    });

    it('validates if project doesnt have upgrades', async () => {
      const upgradeService = await ProjectUpgradeSevice.create(
        demoProjects[0],
        (id) => Promise.resolve(demoProjects[parseInt(id, 10)]),
        mockSchemaMigrationService,
        1
      );

      const indexedData = {1: '0', 10: '1', 20: '2', 30: '3', 40: '4', 50: '5'};
      expect(upgradeService.validateIndexedData(indexedData)).toEqual(undefined);
    });
  });
});
