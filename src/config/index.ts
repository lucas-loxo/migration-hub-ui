// [MH-AI] Components config loader
import type { ComponentConfig } from './componentsConfig';
import components from './components.generated.json';

export const COMPONENTS_CONFIG = components as unknown as ComponentConfig[];

export function getComponentConfig(id: string): ComponentConfig | undefined {
  return COMPONENTS_CONFIG.find((c) => c.component_id === id);
}

// Export sheet mapping for validation
export { SHEET_MAPPING, isValidSheetTab, getValidSheetTabs } from './sheetMapping';

