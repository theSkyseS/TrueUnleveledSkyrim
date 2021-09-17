using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace TrueUnleveledSkyrim
{
    public abstract class DTO
    {
        
    }
    
    public class Follower : DTO
    {
        [JsonProperty] public string Key { get; set; } = string.Empty;
        [JsonProperty] public List<string> ForbiddenKeys { get; set; } = new();
    }

    public class FollowersList : DTO
    {
        [JsonProperty] public List<Follower> Followers { get; set; } = new();
    }

    public class Excluded : DTO
    {
        [JsonProperty] public List<string> Keys { get; set; } = new();
        [JsonProperty] public List<string> ForbiddenKeys { get; set; } = new();
    }

    public class NPCByEDID
    {
        [JsonProperty] public List<string> Keys { get; set; } = new();
        [JsonProperty] public List<string> ForbiddenKeys { get; set; } = new();
        [JsonProperty] public int Level { get; set; } = 0;
    }

    public class NPCsByEDID : DTO
    {
        [JsonProperty] public List<NPCByEDID> NPCs { get; set; } = new();
    }

    public class NPC
    {
        [JsonProperty] public List<string> Keys { get; set; } = new();
        [JsonProperty] public List<string> ForbiddenKeys { get; set; } = new();
        [JsonProperty] public int? MinLevel { get; set; }
        [JsonProperty] public int? MaxLevel { get; set; }
        [JsonProperty] public int? Level { get; set; }
    }

    public class NPCsList : DTO
    {
        [JsonProperty] public List<NPC> NPCs { get; set; } = new();
    }

    public class RaceLevelModifiers : DTO
    {
        [JsonProperty] public List<string> Keys { get; set; } = new();
        [JsonProperty] public List<string> ForbiddenKeys { get; set; } = new();
        [JsonProperty] public int LevelModifier { get; set; }
    }
    
    public class ZoneType
    {
        [JsonProperty] public List<string> Keys { get; set; } = new();
        [JsonProperty] public List<string> ForbiddenKeys { get; set; } = new();
        [JsonProperty] public int MinLevel { get; set; }
        [JsonProperty] public int MaxLevel { get; set; }
        [JsonProperty] public int Range { get; set; }
        [JsonProperty] public bool EnableCombatBoundary;
    }
    
    public class ZoneTypes : DTO
    {
        [JsonProperty] public List<ZoneType> Zones { get; set; } = new();
    }
}