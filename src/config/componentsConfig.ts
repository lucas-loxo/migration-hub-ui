// [MH-AI] Types for sheet-driven component configuration

export type ComponentType = 'table' | 'button' | 'metric' | 'filter' | 'text';

export interface ComponentConfig {
  component_id: string;
  label: string;
  type: ComponentType;
  sheet_tab: string;
  range: string;
  primary_key_col?: string;
  filter_key?: string;
  depends_on?: string;
  // Parsed from a JSON string or "key=value;key=value" in the sheet
  props?: Record<string, string>;
  notes?: string;
}

