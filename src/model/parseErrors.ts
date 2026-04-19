export interface HillChartParseError {
  line?: number;
  message: string;
  severity: 'warning' | 'error';
}
