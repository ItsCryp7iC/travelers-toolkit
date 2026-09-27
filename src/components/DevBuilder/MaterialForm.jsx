import React from 'react';
import { Field, TextInput, SelectInput, SubTabBar } from './BuilderInputs';
import { REGIONS, MAT_SUB_CATEGORIES } from '../../pages/devBuilder/constants';

export function MaterialForm({ subCat, data, onSubCatChange, onChange }) {
  const set = (k, v) => onChange({ ...data, [k]: v })
  const RegionField = () => (
    <Field label="Region" hint="optional">
      <SelectInput value={data.region ?? REGIONS[REGIONS.length - 1]} onChange={v => set('region', v)} options={REGIONS} />
    </Field>
  )

  return (
    <div>
      <div className="mb-4 p-3 rounded-xl border border-[#60A5FA]/20 bg-[#60A5FA]/5">
        <p className="text-xs text-[#60A5FA]/80 leading-relaxed">
          <span className="font-semibold">ℹ️ New Material</span> — document a new material so you can
          reference it in the Character / Weapon forms.
        </p>
      </div>

      <SubTabBar active={subCat} onChange={onSubCatChange} subCategories={MAT_SUB_CATEGORIES} />

      {subCat === 'normal_boss' && (
        <>
          <Field label="Material Name" hint="Spaces allowed"><TextInput value={data.name} onChange={v => set('name', v)} placeholder="e.g. Basaltilade" /></Field>
          <Field label="Boss Name" hint="Spaces allowed"><TextInput value={data.bossName} onChange={v => set('bossName', v)} placeholder="e.g. Anemo Hypostasis" /></Field>
          <RegionField />
        </>
      )}
      {subCat === 'local_spec' && (
        <><Field label="Material Name" hint="Spaces allowed"><TextInput value={data.name} onChange={v => set('name', v)} placeholder="e.g. Crimson Lotus Bloom" /></Field><RegionField /></>
      )}
      {subCat === 'weekly_boss' && (
        <>
          <Field label="Weekly Boss Name" hint="e.g. Stormterror Dvalin"><TextInput value={data.bossName} onChange={v => set('bossName', v)} placeholder="e.g. Stormterror Dvalin" /></Field>
          <RegionField />
          <Field label="Weekly Boss Mat 1" hint="1st drop (Spaces allowed)"><TextInput value={data.mat1} onChange={v => set('mat1', v)} placeholder="e.g. Dvalin's Sigh" /></Field>
          <Field label="Weekly Boss Mat 2" hint="2nd drop (Spaces allowed)"><TextInput value={data.mat2} onChange={v => set('mat2', v)} placeholder="e.g. Dvalin's Claw" /></Field>
          <Field label="Weekly Boss Mat 3" hint="3rd drop (Spaces allowed)"><TextInput value={data.mat3} onChange={v => set('mat3', v)} placeholder="e.g. Shard of a Foul Legacy" /></Field>
        </>
      )}
      {subCat === 'talent' && (
        <>
          <Field label="Talent Series Name 1 (Mon/Thu)" hint="e.g. Freedom"><TextInput value={data.series1} onChange={v => set('series1', v)} placeholder="e.g. Freedom" /></Field>
          <Field label="Talent Series Name 2 (Tue/Fri)" hint="e.g. Resistance"><TextInput value={data.series2} onChange={v => set('series2', v)} placeholder="e.g. Resistance" /></Field>
          <Field label="Talent Series Name 3 (Wed/Sat)" hint="e.g. Ballad"><TextInput value={data.series3} onChange={v => set('series3', v)} placeholder="e.g. Ballad" /></Field>
          <RegionField />
          <Field label="Domain Name" hint="Spaces allowed"><TextInput value={data.domain} onChange={v => set('domain', v)} placeholder="e.g. Forsaken Rift" /></Field>
        </>
      )}
      {subCat === 'weapon_asc' && (
        <>
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-[var(--gold)] mb-2">Group 1 (Mon/Thu)</h4>
            <Field label="Weapon Material Series 1 Name" hint="e.g. Decarabian"><TextInput value={data.series1Name} onChange={v => set('series1Name', v)} placeholder="e.g. Decarabian" /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="5★ Drop"><TextInput value={data.s1_5} onChange={v => set('s1_5', v)} placeholder="5★ Item" /></Field>
              <Field label="4★ Drop"><TextInput value={data.s1_4} onChange={v => set('s1_4', v)} placeholder="4★ Item" /></Field>
              <Field label="3★ Drop"><TextInput value={data.s1_3} onChange={v => set('s1_3', v)} placeholder="3★ Item" /></Field>
              <Field label="2★ Drop"><TextInput value={data.s1_2} onChange={v => set('s1_2', v)} placeholder="2★ Item" /></Field>
            </div>
          </div>
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-[var(--gold)] mb-2">Group 2 (Tue/Fri)</h4>
            <Field label="Weapon Material Series 2 Name" hint="e.g. Boreal Wolf"><TextInput value={data.series2Name} onChange={v => set('series2Name', v)} placeholder="e.g. Boreal Wolf" /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="5★ Drop"><TextInput value={data.s2_5} onChange={v => set('s2_5', v)} placeholder="5★ Item" /></Field>
              <Field label="4★ Drop"><TextInput value={data.s2_4} onChange={v => set('s2_4', v)} placeholder="4★ Item" /></Field>
              <Field label="3★ Drop"><TextInput value={data.s2_3} onChange={v => set('s2_3', v)} placeholder="3★ Item" /></Field>
              <Field label="2★ Drop"><TextInput value={data.s2_2} onChange={v => set('s2_2', v)} placeholder="2★ Item" /></Field>
            </div>
          </div>
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-[var(--gold)] mb-2">Group 3 (Wed/Sat)</h4>
            <Field label="Weapon Material Series 3 Name" hint="e.g. Dandelion Gladiator"><TextInput value={data.series3Name} onChange={v => set('series3Name', v)} placeholder="e.g. Dandelion Gladiator" /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="5★ Drop"><TextInput value={data.s3_5} onChange={v => set('s3_5', v)} placeholder="5★ Item" /></Field>
              <Field label="4★ Drop"><TextInput value={data.s3_4} onChange={v => set('s3_4', v)} placeholder="4★ Item" /></Field>
              <Field label="3★ Drop"><TextInput value={data.s3_3} onChange={v => set('s3_3', v)} placeholder="3★ Item" /></Field>
              <Field label="2★ Drop"><TextInput value={data.s3_2} onChange={v => set('s3_2', v)} placeholder="2★ Item" /></Field>
            </div>
          </div>
          <RegionField />
          <Field label="Domain Name" hint="Spaces allowed"><TextInput value={data.domain} onChange={v => set('domain', v)} placeholder="e.g. Cecilia Garden" /></Field>
        </>
      )}
      {subCat === 'common_drop' && (
        <>
          <Field label="Enemy Group Name" hint="e.g. Slime"><TextInput value={data.groupName} onChange={v => set('groupName', v)} placeholder="e.g. Slime" /></Field>
          <Field label="1★ Drop" hint="weakest tier"><TextInput value={data.star1} onChange={v => set('star1', v)} placeholder="e.g. Slime Condensate" /></Field>
          <Field label="2★ Drop"><TextInput value={data.star2} onChange={v => set('star2', v)} placeholder="e.g. Slime Secretions" /></Field>
          <Field label="3★ Drop" hint="strongest tier"><TextInput value={data.star3} onChange={v => set('star3', v)} placeholder="e.g. Slime Concentrate" /></Field>
        </>
      )}
      {subCat === 'elite_drop' && (
        <>
          <Field label="Elite Enemy Group Name" hint="e.g. Mitachurl"><TextInput value={data.groupName} onChange={v => set('groupName', v)} placeholder="e.g. Mitachurl" /></Field>
          <Field label="2★ Drop" hint="weakest elite tier"><TextInput value={data.star2} onChange={v => set('star2', v)} placeholder="e.g. Heavy Horn" /></Field>
          <Field label="3★ Drop"><TextInput value={data.star3} onChange={v => set('star3', v)} placeholder="e.g. Black Bronze Horn" /></Field>
          <Field label="4★ Drop" hint="strongest elite tier"><TextInput value={data.star4} onChange={v => set('star4', v)} placeholder="e.g. Black Crystal Horn" /></Field>
        </>
      )}
    </div>
  )
}
