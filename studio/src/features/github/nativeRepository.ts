import type { GitHubRepository, RepositoryAccess } from './github';
import type { RemoteRepository } from './remoteRepository';
import type { PublishSource } from '../publishing/publishSource';
import { nativePublish } from './nativePublish';
import { nativeReview } from './nativeReview';
import { ok } from '../../../vendor/stacki/shared/core/result';
import { publishFailure } from '../publishing/publishFailure';

/** Keep Node's Git transport out of the Worker bundle that owns the GitHub App private key. */
export class NativeRepository implements RepositoryAccess {
  constructor(private readonly access: GitHubRepository | RemoteRepository) {}
  historyConnection() {
    return this.access.publishConnection();
  }
  incoming(base: string) {
    return this.access.incoming(base);
  }
  acceptBase(sha: string) {
    return this.access.acceptBase(sha);
  }
  async review(source: PublishSource, expectedHead: string) {
    const grant = await this.access.reviewConnection().then(ok, publishFailure);
    if (!grant.ok) {
      return grant;
    }
    if (!grant.value.ok) {
      return grant.value;
    }
    return nativeReview(source, expectedHead, grant.value.value);
  }
  async commit(source: PublishSource, expectedHead: string) {
    const grant = await this.access.publishConnection().then(ok, publishFailure);
    if (!grant.ok) {
      return grant;
    }
    if (!grant.value.ok) {
      return grant.value;
    }
    return nativePublish(source, expectedHead, grant.value.value);
  }
}
