using Mutagen.Bethesda.Synthesis.Settings;

namespace TrueUnleveledSkyrim.Settings
{
    public enum MLUSetting
    {
        Vanilla = 0,
        MLU = 1
    }
    public class Settings
    {
        public MLUSetting PatchingType { get; set; } = MLUSetting.Vanilla;
        public bool UnlevelZones { get; set; } = true;
        [SynthesisSettingName("Unlevel LVLI")]
        public bool UnlevelLVLI { get; set; } = true;
        [SynthesisSettingName("Unlevel NPCs")]
        public bool UnlevelNPCs { get; set; } = true;
        public bool RemoveOffsets { get; set; } = false;
        [SynthesisSettingName("Highest Level LVLI")]
        public int HighestLevelLVLI { get; set; } = 27;
        public float MagickaRegenModifier { get; set; } = 1.0f;
        public bool RemoveOldPerks { get; set; } = false;
        public bool DistributePerks { get; set; } = true;
    }
}