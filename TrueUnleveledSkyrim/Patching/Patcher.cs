using System;
using System.Linq;
using Mutagen.Bethesda;
using Mutagen.Bethesda.FormKeys.SkyrimSE;
using Mutagen.Bethesda.Plugins;
using Mutagen.Bethesda.Skyrim;
using Mutagen.Bethesda.Synthesis;
using Noggog;
using TrueUnleveledSkyrim.Initialization;
using TrueUnleveledSkyrim.Settings;

namespace TrueUnleveledSkyrim.Patching
{
    public class Patcher
    {
        public class LeveledListStats
        {
            public int MinLevel { get; set; }
            public int MaxLevel { get; set; }
            public int MediumLevel { get; set; }
            public int LowerThird { get; set; }
            public int HigherThird { get; set; }

            public LeveledListStats(int minLevel, int maxLevel)
            {
                MinLevel = minLevel;
                MaxLevel = maxLevel;
                MediumLevel = (int) Math.Round((MinLevel + MaxLevel) / 2.0);
                LowerThird = (int) Math.Round((MinLevel + MaxLevel) / 3.0);
                HigherThird = (int) Math.Round((MinLevel + MaxLevel) / 3.0) * 2;
            }
        }

        private Excluded _excludedNpCs;
        private ZoneTypes _zoneTypesByEdid;
        private ZoneTypes _zoneTypesByKeyword;

        private IPatcherState<ISkyrimMod, ISkyrimModGetter> _state;

        public Patcher(Lazy<Settings.Settings> settings, IPatcherState<ISkyrimMod, ISkyrimModGetter> state)
        {
            _state = state;
            _excludedNpCs = Helper.LoadJson<Excluded>("TrueUnleveledSkyrim/Data/excludedNPCs.json");
            switch (settings.Value.PatchingType)
            {
                case MLUSetting.MLU:
                    _zoneTypesByEdid = Helper.LoadJson<ZoneTypes>("TrueUnleveledSkyrim/Data/zoneTypesByEDIDMLU.json");
                    _zoneTypesByKeyword =
                        Helper.LoadJson<ZoneTypes>("TrueUnleveledSkyrim/Data/zoneTypesByKeywordMLU.json");
                    break;
                case MLUSetting.Vanilla:
                    _zoneTypesByEdid = Helper.LoadJson<ZoneTypes>("TrueUnleveledSkyrim/Data/zoneTypesByEDID.json");
                    _zoneTypesByKeyword =
                        Helper.LoadJson<ZoneTypes>("TrueUnleveledSkyrim/Data/zoneTypesByKeyword.json");
                    break;
                default:
                    throw new ArgumentOutOfRangeException(nameof(settings));
            }
        }

        public bool IsAllowedToPatch(INpcGetter npcRecord)
        {
            string editorId = npcRecord.EditorID ?? "";
            return !_excludedNpCs.Keys.Any(key => editorId.Contains(key)) ||
                   _excludedNpCs.ForbiddenKeys.Any(forbiddenKey => editorId.Contains(forbiddenKey));
        }

        public LeveledListStats GetListStats(ILeveledItemGetter list)
        {
            var minLevel = int.MaxValue;
            var maxLevel = int.MinValue;

            if (list.Entries == null) throw new EmptyListException(list);
            foreach (short level in list.Entries
                .SkipWhile(item => item.Data == null)
                .Select(item => item.Data!.Level))
            {
                if (level < minLevel) minLevel = level;
                if (level > maxLevel) maxLevel = level;
            }

            return new LeveledListStats(minLevel, maxLevel);
        }

        public void UnlevelZones()
        {
            foreach (var zone in _state.LoadOrder.PriorityOrder.EncounterZone().WinningOverrides())
            {
                Random rnd = new Random();
                IFormLinkGetter<ILocationGetter> locationLink = zone.Location;
                if (locationLink.IsNull) continue;
                ILocationGetter? location;
                if (!locationLink.TryResolve<ILocationGetter>(_state.LinkCache, out location))
                {
                    throw new LocationNotFoundException(locationLink);
                }

                ZoneType? locationZoneType = _zoneTypesByEdid.Zones
                    .Where(zoneType => zoneType.Keys.Any(key => location.EditorID?.Contains(key) ?? false))
                    .FirstOrDefault(zoneType =>
                        !zoneType.ForbiddenKeys.Any(fkey => location.EditorID?.Contains(fkey) ?? false));

                if (locationZoneType is null && location.Keywords is not null)
                {
                    foreach (var keywordLink in location.Keywords)
                    {
                        if (!keywordLink.TryResolve(_state.LinkCache, out var keyword)) continue;
                        locationZoneType = _zoneTypesByKeyword.Zones.FirstOrDefault(zoneType =>
                            zoneType.Keys.Any(key => keyword.EditorID == key));
                        break;
                    }
                }

                if (locationZoneType is null)
                {
                    int vanillaMinLevel = zone.MinLevel;
                    int vanillaMaxLevel = zone.MaxLevel;
                    int newMinLevel = vanillaMinLevel;
                    int newMaxLevel = vanillaMaxLevel;
                    if (newMinLevel < 10) newMinLevel = 10;
                    if (newMaxLevel is <= 0 or > 100) newMaxLevel = newMinLevel * 3;
                    locationZoneType = new ZoneType
                    {
                        MaxLevel = newMaxLevel,
                        MinLevel = newMinLevel,
                        Range = newMaxLevel - newMinLevel
                    };
                    Console.WriteLine(
                        $"The location {location.EditorID} was unleveled using default values. Specify more encounter zone types in zoneTypesByEDID.json or zoneTypesByKeyword.json");
                }

                EncounterZone? zoneCopy = _state.PatchMod.EncounterZones.GetOrAddAsOverride(zone);
                zoneCopy.Flags &= ~EncounterZone.Flag.MatchPcBelowMinimumLevel;
                if (!locationZoneType.EnableCombatBoundary)
                {
                    zoneCopy.Flags &= ~EncounterZone.Flag.DisableCombatBoundary;
                }

                int min = locationZoneType.MinLevel;
                int max = locationZoneType.MaxLevel - locationZoneType.Range;
                var minLvl = (sbyte) (Math.Floor(rnd.NextDouble() * (max - min + 1)) + min);
                var maxLvl = (sbyte) (minLvl + locationZoneType.Range);
                zoneCopy.MinLevel = minLvl;
                zoneCopy.MaxLevel = maxLvl;
            }
        }

        public void UnlevelLeveledLists()
        {
        }


        private void UnlevelItemList(ILeveledItemGetter list, int minAllowedLevel, int maxAllowedLevel)
        {
            bool LvliRecursive(IItemGetter item)
            {
                switch (item)
                {
                    case ILeveledItemGetter leveledItemGetter:
                        return leveledItemGetter.Entries is not null && leveledItemGetter.Entries.All(getter =>
                        {
                            if (getter.Data is null) return false;
                            return getter.Data.Reference.TryResolve(_state.LinkCache, out var record) &&
                                   LvliRecursive(record);
                        });
                    case IWeaponGetter weaponGetter:
                        return weaponGetter.Keywords != null &&
                               weaponGetter.Keywords.Any(x => Equals(x, Skyrim.Keyword.WeapMaterialGlass));
                    case IArmorGetter armorGetter:
                        return armorGetter.Keywords != null &&
                               armorGetter.Keywords.Any(x => Equals(x, Skyrim.Keyword.ArmorMaterialGlass));
                    default:
                        return false;
                }
            }

            bool IsRemoveItem(ILeveledItemEntryGetter item)
            {
                if (item.Data is null) return true;
                short level = item.Data.Level;
                bool isRemoved = level > maxAllowedLevel && maxAllowedLevel != 0 || level < minAllowedLevel;
                if (level == maxAllowedLevel && !isRemoved &&
                    item.Data.Reference.TryResolve(_state.LinkCache, out var lItem)
                    && LvliRecursive(lItem))
                {
                    isRemoved = true;
                }

                return isRemoved;
            }

            if (list.Entries is null || list.Entries.Count == 0) throw new EmptyListException(list);
            
            bool hasAppropriateItems = !list.Entries.Any(IsRemoveItem);
            if (hasAppropriateItems)
            {
                LeveledItem listCopy = _state.PatchMod.LeveledItems.GetOrAddAsOverride(list);
                listCopy.Entries!.Where(IsRemoveItem).ForEach(x => listCopy.Entries!.Remove(x));
            }
            LeveledItem listCopyTwo = _state.PatchMod.LeveledItems.GetOrAddAsOverride(list);
            listCopyTwo.Entries!.Where(x => x.Data is not null).ForEach(x => x.Data!.Level = 1);
        }

        private ILeveledItem CopyList(ILeveledItemGetter list, string suffix)
        {
            
        }
    }
}