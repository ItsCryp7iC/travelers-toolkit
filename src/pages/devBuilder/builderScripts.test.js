import { describe, it, expect } from 'vitest';
import { generateNodeScript, generateAssetScript } from './builderScripts';

describe('builderScripts', () => {
  describe('generateNodeScript', () => {
    it('generates a script containing the staged data payload', () => {
      const stagedUpdates = {
        "characters.json": [{ id: "TestChar", name: "Test Char" }]
      };

      const script = generateNodeScript(stagedUpdates);

      expect(script).toContain("const fs = require('fs');");
      expect(script).toContain("const stagedData = {");
      expect(script).toContain('"id": "TestChar"');
      expect(script).toContain('fs.readFileSync(filePath, \'utf-8\');');
      expect(script).toContain('currentData.push(...stagedData[filename]);');
      expect(script).toContain('fs.writeFileSync(filePath, JSON.stringify(currentData, null, 2));');
    });

    it('contains sorting logic for release_order and sortOrder', () => {
      const stagedUpdates = {};
      const script = generateNodeScript(stagedUpdates);

      expect(script).toContain('parseFloat(a.release_order)');
      expect(script).toContain('parseFloat(a.sortOrder)');
    });
  });

  describe('generateAssetScript', () => {
    it('maps filenames to their appropriate directories', () => {
      const stagedUpdates = {
        "characters.json": [{ name: "Test Char" }],
        "weapons.json": [{ name: "Test Weapon" }],
        "talent_materials.json": [{ tiers: { "4_star": { name: "Test Talent" } } }]
      };

      const script = generateAssetScript(stagedUpdates);

      expect(script).toContain('"characters.json": "characters"');
      expect(script).toContain('"weapons.json": "weapons"');
      expect(script).toContain('"talent_materials.json": "talent_materials"');

      // Verify items extraction
      expect(script).toContain('Test Char');
      expect(script).toContain('Test Weapon');
      expect(script).toContain('Test Talent');
    });

    it('includes runDownloads function and URL construction', () => {
      const script = generateAssetScript({});

      expect(script).toContain('runDownloads()');
      expect(script).toContain('https://genshin-impact.fandom.com/api.php');
      expect(script).toContain('let prefix = "Item_"');
    });
  });
});
