import React from 'react';
import { Field, TextInput, SelectInput, ComboInput, MatHeader } from './BuilderInputs';
import { WEAPON_TYPES } from '../../pages/devBuilder/constants';

export function WeaponForm({ data, onChange, suggestions }) {
  const set = (k, v) => onChange({ ...data, [k]: v })
  const setMat = (k, v) => onChange({ ...data, materials: { ...data.materials, [k]: v } })

  return (
    <div>
      <Field label="Weapon Name" hint="Spaces allowed; ID generates automatically">
        <TextInput value={data.name} onChange={v => set('name', v)} placeholder="e.g. Staff of Homa" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Rarity">
          <SelectInput value={data.rarity} onChange={v => set('rarity', Number(v))}
            options={[5, 4, 3, 2, 1].map(r => ({ value: r, label: `${r}★` }))} />
        </Field>
        <Field label="Weapon Type" hint="type">
          <SelectInput value={data.type} onChange={v => set('type', v)} options={WEAPON_TYPES} />
        </Field>
      </div>

      <MatHeader />

      <Field label="Weapon Ascension Mat" hint="ascension_material_family_id">
        <ComboInput value={data.materials.ascension_material_family_id} onChange={v => setMat('ascension_material_family_id', v)}
          placeholder="e.g. DecarabianTiles" listId="dl-asc-mat" suggestions={suggestions.ascensionMat} />
      </Field>
      <Field label="Elite Mob Drop Base" hint="enhancement_material_family_id">
        <ComboInput value={data.materials.enhancement_material_family_id} onChange={v => setMat('enhancement_material_family_id', v)}
          placeholder="e.g. Mitachurl" listId="dl-elite-mat" suggestions={suggestions.eliteMat} />
      </Field>
      <Field label="Common Mob Drop Base" hint="enemy_material_family_id">
        <ComboInput value={data.materials.enemy_material_family_id} onChange={v => setMat('enemy_material_family_id', v)}
          placeholder="e.g. Slime" listId="dl-mob-mat" suggestions={suggestions.mobMat} />
      </Field>
    </div>
  )
}
