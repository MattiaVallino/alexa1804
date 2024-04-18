const Alexa = require('ask-sdk-core');
const constants = require('./constants');
const logic = require('./logic'); // this file encapsulates all "business" logic
const i18n = require('i18next'); 
const sprintf = require('i18next-sprintf-postprocessor'); 
const moment = require('moment-timezone'); 
/* *


 * Below we use async and await ( more info: javascript.info/async-await )
 * It's a way to wrap promises and waait for the result of an external async operation
 * Like getting and saving the persistent attributes
 * */
 

const LoadAttributesRequestInterceptor = {
    async process(handlerInput) {
        const {attributesManager, requestEnvelope} = handlerInput;
        const sessionAttributes = attributesManager.getSessionAttributes();
        // the "loaded" check is because the "new" session flag is lost if there's a one shot utterance that hits an intent with auto-delegate
        if (Alexa.isNewSession(requestEnvelope) || !sessionAttributes['loaded']){ //is this a new session? not loaded from db?
            const persistentAttributes = await attributesManager.getPersistentAttributes() || {};
            //console.log('Loading from persistent storage: ' + JSON.stringify(persistentAttributes));
            persistentAttributes['loaded'] = true;
            //copy persistent attribute to session attributes
            attributesManager.setSessionAttributes(persistentAttributes); // ALL persistent attributtes are now session attributes
        }
    }
};

// If you disable the skill and reenable it the userId might change and you loose the persistent attributes saved below as userId is the primary key
const SaveAttributesResponseInterceptor = {
    async process(handlerInput, response) {
        if (!response) return; // avoid intercepting calls that have no outgoing response due to errors
        const {attributesManager, requestEnvelope} = handlerInput;
        const sessionAttributes = attributesManager.getSessionAttributes();
        const shouldEndSession = (typeof response.shouldEndSession === "undefined" ? true : response.shouldEndSession); //is this a session end?
        // the "loaded" check is because the session "new" flag is lost if there's a one shot utterance that hits an intent with auto-delegate
        const loadedThisSession = sessionAttributes['loaded'];
        if ((shouldEndSession || Alexa.getRequestType(requestEnvelope) === 'SessionEndedRequest') && loadedThisSession) { // skill was stopped or timed out
            // we increment a persistent session counter here
            sessionAttributes['sessionCounter'] = sessionAttributes['sessionCounter'] ? sessionAttributes['sessionCounter'] + 1 : 1;
            // limiting save of session attributes to the ones we want to make persistent
            for (var key in sessionAttributes) {
                if (!constants.PERSISTENT_ATTRIBUTES_NAMES.includes(key))
                    delete sessionAttributes[key];
            }
            //console.log('Saving to persistent storage:' + JSON.stringify(sessionAttributes));
            attributesManager.setPersistentAttributes(sessionAttributes);
       
            await attributesManager.savePersistentAttributes();
        }
    }
};


const languageStrings = {
    'it' : require('./it')
};

const  LocalisationRequestInterceptor = {
    process(handlerInput) {
        const localizationClient = i18n.use(sprintf).init({
            lng: handlerInput.requestEnvelope.request.locale,
            fallbackLng: 'it', // fallback to EN if locale doesn't exist
            resources: languageStrings
        });

        localizationClient.localize = function () {
            const args = arguments;
            let values = [];

            for (var i = 1; i < args.length; i++) {
                values.push(args[i]);
            }
            const value = i18n.t(args[0], {
                returnObjects: true,
                postProcess: 'sprintf',
                sprintf: values
            });

            if (Array.isArray(value)) {
                return value[Math.floor(Math.random() * value.length)];
            } else {
                return value;
            }
        }

        const attributes = handlerInput.attributesManager.getRequestAttributes();
        attributes.t = function (...args) { // pass on arguments to the localizationClient
            return localizationClient.localize(...args);
        };
    },
};


const CheckTherapiesRequestInterceptor = {
    async process(handlerInput) {
         const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        if(sessionAttributes['access_token']!==undefined){
       
        let access_token = sessionAttributes['access_token'];
        const timezone = "Europe/Rome";
        let startDate = logic.convertDateForDatabase(moment().tz(timezone).subtract(7, 'days')); // bisogna farlo iniziare prima del giorno stesso
        let endDate = logic.convertDateForDatabase(moment().tz(timezone).add(4, 'months')); 
        let therapiesChecked= await logic.getTherapies(access_token,startDate,endDate); 

      // da trasformare in flag che va in session attributes 
    if (therapiesChecked.edit_therapies.length !==0 ||  therapiesChecked.new_therapies.length !==0 || therapiesChecked.updated_therapies.length !==0 ){
            
       sessionAttributes['flag_therapies']=1;
       }else {
       
           sessionAttributes['flag_therapies']=0;
       }
       
    }
        
    }
};


const PostIntentResponseInterceptor = {
    async process(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        if(sessionAttributes['access_token']!==undefined){
        let access_token = sessionAttributes['access_token'];
        const timezone = "Europe/Rome";
        let now = logic.convertDateForDatabase(moment().tz(timezone)); // bisogna farlo iniziare prima del giorno stesso
       let intent= sessionAttributes['current_intent'];
      // da trasformare in flag che va in session attributes 
        }
       
    }
        
    
};

module.exports = {
    LoadAttributesRequestInterceptor,
    SaveAttributesResponseInterceptor,
    LocalisationRequestInterceptor,
    CheckTherapiesRequestInterceptor,
    PostIntentResponseInterceptor
    
}