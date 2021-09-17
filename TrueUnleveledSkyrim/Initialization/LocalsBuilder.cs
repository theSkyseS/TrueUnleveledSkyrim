using System.Collections.Generic;
using Mutagen.Bethesda;
using Mutagen.Bethesda.FormKeys.SkyrimSE;
using Mutagen.Bethesda.Plugins;
using Mutagen.Bethesda.Plugins.Exceptions;
using Mutagen.Bethesda.Skyrim;
using Mutagen.Bethesda.Synthesis;

namespace TrueUnleveledSkyrim.Initialization
{
    public class LocalsBuilder
    {
        public int LevelUpSpeed { get; }
        public Dictionary<Skill, ActorValue> ActorValues { get; } = new()
        {
            {Skill.OneHanded, ActorValue.OneHanded},
            {Skill.TwoHanded, ActorValue.TwoHanded},
            {Skill.Archery, ActorValue.Archery},
            {Skill.Block, ActorValue.Block},
            {Skill.Smithing, ActorValue.Smithing},
            {Skill.HeavyArmor, ActorValue.HeavyArmor},
            {Skill.LightArmor, ActorValue.LightArmor},
            {Skill.Pickpocket, ActorValue.Pickpocket},
            {Skill.Lockpicking, ActorValue.Lockpicking},
            {Skill.Sneak, ActorValue.Sneak},
            {Skill.Alchemy, ActorValue.Alchemy},
            {Skill.Speech, ActorValue.Speech},
            {Skill.Alteration, ActorValue.Alteration},
            {Skill.Conjuration, ActorValue.Conjuration},
            {Skill.Destruction, ActorValue.Destruction},
            {Skill.Illusion, ActorValue.Illusion},
            {Skill.Restoration, ActorValue.Restoration},
            {Skill.Enchanting, ActorValue.Enchanting}
        };

        public List<string> DefaultPerkEdids { get; } = new()
        {
            "AlchemySkillBoosts", 
            "PerkSkillBoosts", 
            "TorchBashPerk"
        };

        public LocalsBuilder(IPatcherState<SkyrimMod, ISkyrimModGetter> state)
        {
            var skillsLevelUpRecord =
                (GameSettingInt) Skyrim.GameSetting.iAVDSkillsLevelUp.Resolve(state.LinkCache);
            if (skillsLevelUpRecord.Data == null) throw RecordException.Create("\nData of iAVDSkillsLevelUp is null", skillsLevelUpRecord);
            LevelUpSpeed = skillsLevelUpRecord.Data.Value;
        }

        
    }
}