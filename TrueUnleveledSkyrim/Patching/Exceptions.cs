using System;
using Mutagen.Bethesda.Plugins;
using Mutagen.Bethesda.Skyrim;

namespace TrueUnleveledSkyrim.Patching
{
    public class EmptyListException : Exception
    {
        public ILeveledItemGetter LeveledList { get; set; }

        public EmptyListException(ILeveledItemGetter leveledList)
        {
            LeveledList = leveledList;
        }
    }

    public class LocationNotFoundException : Exception
    {
        public IFormLinkGetter<ILocationGetter> LocationGetterLink { get; set; }

        public LocationNotFoundException(IFormLinkGetter<ILocationGetter> locationGetterLink)
        {
            LocationGetterLink = locationGetterLink;
        }
    }
}