export const APPLICATION_IPC: Readonly<{
  APPLICATION_READY: string;
  APPLICATION_CLOSE: string;
  APPLICATION_MINIMIZE: string;
  APPLICATION_MAXIMIZE: string;
  APPLICATION_OPEN_URL: string;
}> = {
  APPLICATION_READY: 'application:ready',
  APPLICATION_CLOSE: 'application:close',
  APPLICATION_MINIMIZE: 'application:minimize',
  APPLICATION_MAXIMIZE: 'application:maximize',
  APPLICATION_OPEN_URL: 'application:open_url',
};
