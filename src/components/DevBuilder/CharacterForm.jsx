import React from 'react';
import { Field, TextInput, SelectInput, ComboInput, MatHeader } from './BuilderInputs';
import { ELEMENTS, WEAPON_TYPES, getGemFamily } from '../../pages/devBuilder/constants';

export function CharacterForm({ data, onChange, suggestions }) {
  const set = (k, v) => onChange({ ...data, [k]: v })
  const setMat = (k, v) => onChange({ ...data, materials: { ...data.materials, [k]: v } })

  return (
    <div>
      <Field label="Character Name" hint="Spaces allowed; ID generates automatically">
        <TextInput value={data.name} onChange={v => set('name', v)} placeholder="e.g. Hu Tao" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Rarity">
          <SelectInput value={data.rarity} onChange={v => set('rarity', Number(v))}
            options={[5, 4].map(r => ({ value: r, label: `${r}★` }))} />
        </Field>
        <Field label="Element">
          <SelectInput value={data.element} onChange={v => {
            onChange({
              ...data,
              element: v,
              materials: {
                ...data.materials,
                gem_family_id: getGemFamily(v)
              }
            });
          }} options={ELEMENTS} />
        </Field>
      </div>

      <Field label="Weapon Type">
        <SelectInput value={data.weapon_type} onChange={v => set('weapon_type', v)} options={WEAPON_TYPES} />
      </Field>

      <MatHeader />

      <Field label="World Boss Drop" hint="world_boss_material_id">
        <ComboInput value={data.materials.world_boss_material_id} onChange={v => setMat('world_boss_material_id', v)}
          placeholder="e.g. BasaltiladeOfDragon" listId="dl-world-boss" suggestions={suggestions.worldBoss} />
      </Field>
      <Field label="Weekly Boss Drop" hint="weekly_boss_material_id">
        <ComboInput value={data.materials.weekly_boss_material_id} onChange={v => setMat('weekly_boss_material_id', v)}
          placeholder="e.g. DvalinsSigh" listId="dl-weekly-boss" suggestions={suggestions.weeklyBoss} />
      </Field>
      <Field label="Talent Book Series" hint="talent_material_family_id">
        <ComboInput value={data.materials.talent_material_family_id} onChange={v => setMat('talent_material_family_id', v)}
          placeholder="e.g. Diligence" listId="dl-talent-book" suggestions={suggestions.talentBook} />
      </Field>
      <Field label="Common Mob Drop Base" hint="enemy_material_family_id">
        <ComboInput value={data.materials.enemy_material_family_id} onChange={v => setMat('enemy_material_family_id', v)}
          placeholder="e.g. Samachurl" listId="dl-mob-material" suggestions={suggestions.mobMaterial} />
      </Field>
      <Field label="Local Specialty" hint="local_specialty_id">
        <ComboInput value={data.materials.local_specialty_id} onChange={v => setMat('local_specialty_id', v)}
          placeholder="e.g. CrimsonLotusBloom" listId="dl-local-spec" suggestions={suggestions.localSpec} />
      </Field>
      <Field label="Gemstone Base Name" hint="gem_family_id">
        <ComboInput value={data.materials.gem_family_id} onChange={v => setMat('gem_family_id', v)}
          placeholder="e.g. AgnidusAgate" listId="dl-gemstone" suggestions={suggestions.gemstone} />
      </Field>
    </div>
  )
}
