const getosv2_url = (region) => {
   const mappings = {
       
	   //US
	   'us-e1': 'us-east-1',
       'us-e2': 'us-east-2',
       'us-w1': 'us-west-1',
	   'us-w2': 'us-west-2',
	   'sg-s1': 'ap-southeast-1', //Asia Pacific (Singapore)
	   'au-s1': 'ap-southeast-2', //Asia Pacific (Sydney)
	   'jp-e1': 'ap-northeast-1', //Asia Pacific (Tokyo)
	   'ca-c1': 'ca-central-1',   //Canada (Central)
	   'de-c1': 'eu-central-1',   //Europe (Frankfurt) 
	   'ir-e1': 'eu-west-1',      //Europe (Ireland)
	   'uk-e1': 'eu-west-2', 	//Europe (London)
	   'br-s1': 'sa-east-1',      //South America (Sao Paulo)
	   
	    //US GOV
	   'usg-w1.gov': 'us-gov-west-1',
	   
	   //EU
	   'de-c1.eu1': 'eu-central-1', //Europe (Frankfurt)  
	   'ir-e1.eu1': 'eu-west-1', //Europe (Ireland)
	   
	   //Canada Cloud
	   'ca-c1': 'ca-central-1',
	   
	   //Japan Cloud
	   
	   'jp-e1': 'ap-northeast-1',  
	   
	   
	   
   };
   return mappings[region] || region;  // se non trova corrispondenza, ritorna la stringa originale
};

const extractRegion = (domain) => {
    if (!domain) return null;
    const parts = domain.split('.');
    return parts.length === 4 ? parts[1] : null;
};

const extractCloudHub2Region = (value) => {
   if (!value) return null;
   if (!value.startsWith('cloudhub-')) return null;
   return value.split('cloudhub-')[1];
};

module.exports = {
    getosv2_url,
    extractRegion,
	extractCloudHub2Region
};