import {
  AggregateRoot,
  DomainInvariantError,
  VerdaccioPackageName,
  type PluginExtensionSlot,
} from '../shared/ddd.ts';

export interface PluginPackageProps {
  packageName: VerdaccioPackageName;
  version: string;
  title: string;
  category: string;
  author: string;
  description: string;
  slot: PluginExtensionSlot;
  tarballSha512: string;
  verdaccioUrl: string;
  permissionsRequired: string[];
  defaultConfig: Record<string, unknown>;
}

const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export class PluginPackageAggregate extends AggregateRoot<PluginPackageProps> {
  private constructor(id: string, props: PluginPackageProps) {
    super(id, props);
  }

  static publishNew(params: {
    id: string;
    npmPackageName: string;
    version: string;
    title: string;
    category: string;
    author: string;
    description: string;
    slot: PluginExtensionSlot;
    registryUrl: string;
    tarballSha512: string;
    tenantId: string;
    actorId: string;
    permissionsRequired?: string[];
    defaultConfig?: Record<string, unknown>;
  }): PluginPackageAggregate {
    const pkgName = VerdaccioPackageName.create(params.npmPackageName);
    if (!SEMVER_RE.test(params.version)) {
      throw new DomainInvariantError(
        `Версия ${params.version} должна соответствовать SemVer (например, 1.0.0)`,
        'INVALID_SEMVER',
        'marketplace'
      );
    }
    const base = params.registryUrl.replace(/\/+$/, '');
    const verdaccioUrl = `${base}/${pkgName.fullName}/-/${pkgName.tarballFilename(params.version)}`;

    const agg = new PluginPackageAggregate(params.id, {
      packageName: pkgName,
      version: params.version,
      title: params.title.trim(),
      category: params.category,
      author: params.author.trim(),
      description: params.description.trim(),
      slot: params.slot,
      tarballSha512: params.tarballSha512,
      verdaccioUrl,
      permissionsRequired: params.permissionsRequired || ['deals:read'],
      defaultConfig: params.defaultConfig || { publishedToVerdaccio: true, registry: base },
    });

    agg.addDomainEvent({
      eventName: 'PluginPublishedToVerdaccio',
      subject: 'verdaccio.package.published',
      aggregateType: 'PluginPackageAggregate',
      boundedContext: 'marketplace',
      tenantId: params.tenantId,
      actorId: params.actorId,
      payload: {
        npmPackageName: pkgName.fullName,
        version: params.version,
        slot: params.slot,
      },
    });

    return agg;
  }

  get persistenceRecord() {
    return {
      id: this.id,
      npmPackageName: this.props.packageName.fullName,
      version: this.props.version,
      verdaccioUrl: this.props.verdaccioUrl,
      tarballSha512: this.props.tarballSha512,
      name: this.props.title,
      category: this.props.category,
      author: this.props.author,
      description: this.props.description,
      slot: this.props.slot,
      permissionsRequired: this.props.permissionsRequired,
      defaultConfig: this.props.defaultConfig,
    };
  }
}
