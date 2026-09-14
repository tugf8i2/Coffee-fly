export function createLatestRequestController() {
  let generation = 0;
  let controller = null;

  return {
    start() {
      controller?.abort();
      controller = new AbortController();
      generation += 1;
      return { generation, signal: controller.signal };
    },
    isCurrent(request) {
      return request.generation === generation && !request.signal.aborted;
    },
    invalidate() {
      generation += 1;
      controller?.abort();
      controller = null;
    },
  };
}
