"""Entrypoint: python worker.py  ->  runs the RQ worker consuming the
'investigations' queue. Run one or more of these as a separate process/container
from the API (see docker-compose.yml's `worker` service).

Uses SimpleWorker (processes jobs in-process, no fork-per-job) rather than RQ's
default forking Worker. This sidesteps a macOS-specific crash where forking a
child process after certain native libraries (httpx/psycopg's TLS stack) have
touched the Objective-C runtime aborts with `objc_initializeAfterForkError`;
it's also simply less overhead for jobs this short. Run multiple containers
(see docker-compose.yml) for horizontal scaling instead of relying on per-job
process isolation."""

from rq import SimpleWorker

from app.workers.queue import _redis, investigation_queue

if __name__ == "__main__":
    worker = SimpleWorker([investigation_queue], connection=_redis)
    worker.work()
