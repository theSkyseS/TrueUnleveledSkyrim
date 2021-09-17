using System.IO;
using Newtonsoft.Json;

namespace TrueUnleveledSkyrim.Initialization
{
    public static class Helper
    {
        public static T LoadJson<T>(string filePath) where T: DTO
        {
            var fileString = File.ReadAllText(filePath);
            var jsonObject = JsonConvert.DeserializeObject<T>(fileString);
            if (jsonObject is null) throw new FileNotFoundException("No file found or empty:" + filePath);
            return jsonObject;
        }
    }
}