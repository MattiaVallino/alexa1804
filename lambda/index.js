/* *
 * This sample demonstrates handling intents from an Alexa skill using the Alexa Skills Kit SDK (v2).
 * Please visit https://alexa.design/cookbook for additional examples on implementing slots, dialog management,
 * session persistence, api calls, and more.
 * */
const Alexa = require('ask-sdk-core');

const interceptors = require('./interceptors');
const util = require('./util'); // utility functions
const logic = require('./logic'); // this file encapsulates all "business" logic
const constants = require('./constants');
const moment = require('moment-timezone'); // will help us do all the dates math while considering the timezone


const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
      console.log('in LaunchRequest')
      let  sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
      
        // heck if the user has given permission for reminders to the skill from the alexa app
        const reminderApiClient = handlerInput.serviceClientFactory.getReminderManagementServiceClient(),
        { permissions } = handlerInput.requestEnvelope.context.System.user 
         
        let substr=permissions["scopes"];
        substr=JSON.stringify(substr);
        let checksub=substr.indexOf("DENIED");
        let speakOutput
        if(permissions===undefined || checksub>=0) {
           const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
           
            speakOutput=requestAttributes.t('PERMISSION_ERROR_MSG');
          
            return handlerInput.responseBuilder
               .speak(speakOutput)
               .getResponse()
        }
        
        sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        
        let name = sessionAttributes['name'];
        let access_token = sessionAttributes['access_token'];
     
        if (!name || !access_token){
            const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
            speakOutput=requestAttributes.t('SECURITY_CODE_FIRST_TIME_MSG');
            
            // utterance of SecurityCodeIntent
            
            return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt()
            .getResponse();
        }
        
        console.log("Launch Intent completed successfully.")
            
        return LoadTherapiesIntentHandler.handle(handlerInput);
         
    }
};


const SecurityCodeIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'SecurityCodeIntent';
    },
    async handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
     console.log('in securitycode')
        // saving the otp spoken by the user to alexa
        let otp = handlerInput.requestEnvelope.request.intent.slots.otpnew.value;
       
        // via the logic.getAccessToken function getting 'name' and 'access_token' and save them in session
        let response;
        
        await logic.getAccessToken(otp).then(res =>{
            //console.log('res: '+    JSON.stringify(res))
                response = res;
            })
            .catch((error) => {
                console.log(error);
               
            });
            
        if(!response){
            const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
            const speakOutput=requestAttributes.t('SECURITY_CODE_ERROR');
            
            // utterance of SecurityCodeIntent
            
            return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt()
            .getResponse();
        }
        else{
          
            let name = response.data.user.name?response.data.user.name:"utente";
            sessionAttributes['name'] = name;
            let access_token = response.data.access_token;
            sessionAttributes['access_token'] = access_token;
            console.log('name '+ name + ' --- token: '+ access_token)
            // Post logs
            let typeOfAccess = 'Security Code Intent';
            let logResponse = await logic.postLogs(access_token, typeOfAccess);
        
            const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
            const speakOutput=requestAttributes.t('LOAD_THERAPY_MSG',name);
            
            // utterance of LoadTherapiesIntent
        
            return handlerInput.responseBuilder
                .speak(speakOutput)
                .reprompt()
                .getResponse();
        }
    }
};


const LoadTherapiesIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'LoadTherapiesIntent';
    },
    async handle(handlerInput) {
        
        console.log('in LoadTherapiesIntent')
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        let access_token = sessionAttributes['access_token'];
        
        let count_new_therapies = 0;
        let count_updated_therapies = 0;
        sessionAttributes['count_new_therapies'] = count_new_therapies;
        sessionAttributes['count_updated_therapies'] = count_updated_therapies;
      
      
      
       const timezone = "Europe/Rome";
       
        let startDate = logic.convertDateForDatabase(moment().tz(timezone).subtract(7, 'days')); // bisogna farlo iniziare prima del giorno stesso
        let endDate = logic.convertDateForDatabase(moment().tz(timezone).add(4, 'months')); 
        let therapiesChecked= await logic.getTherapies(access_token,startDate,endDate) 
       
        sessionAttributes['all_therapies'] = therapiesChecked.all_therapies;
        //save in edit_therapies therapies that have therapy.edit = 'updated' or 'new'
        //sessionAttributes['edit_therapies'] = therapiesChecked.edit_therapies;
        //save in updated_therapies therapies that have therapy.edit ='updated'
        sessionAttributes['updated_therapies'] = therapiesChecked.updated_therapies;
        //save in new_therapies that have therapy.edit='new' e therapy.state = true
        sessionAttributes['new_therapies'] = therapiesChecked.new_therapies;
     

        // Post logs
        let typeOfAccess = 'Load Therapies Intent';
        let logResponse = await logic.postLogs(access_token, typeOfAccess);
      
        
        return SayTherapyIntentHandler.handle(handlerInput);
         
       
    }
};

const SayTherapyIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'SayTherapyIntent';
    },
    async handle(handlerInput) {
       console.log('in SayTherapyIntent')
        
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        let access_token = sessionAttributes['access_token'];
        //get Therapies that have therapy.edit='new' e therapy.state = true
        let count_new_therapies = sessionAttributes['count_new_therapies'];
        let new_therapies = sessionAttributes['new_therapies'];

        //get Therapies that have therapy.edit ='updated'
        let count_updated_therapies = sessionAttributes['count_updated_therapies'];
        let updated_therapies = sessionAttributes['updated_therapies'];
     
        let speakOutput;
        //manage Therapies that have therapy.edit='new' to setup
        if(count_new_therapies < new_therapies.length) {
            
            let new_therapy_name  = new_therapies[count_new_therapies].drug.split("-")[0];
              
              const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
             speakOutput=requestAttributes.t('NEW_THERAPY_MSG',new_therapy_name);
            
             
            // utterance of CreateTherapyIntentHandler
        }  
        //manage Therapies that have therapy.edit='updated' to setup
        else if(count_new_therapies >= new_therapies.length && count_updated_therapies < updated_therapies.length){
          
            let updated_therapy_name  = updated_therapies[count_updated_therapies].drug.split("-")[0];
             const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
            speakOutput=requestAttributes.t('UPDATED_THERAPY_MSG',updated_therapy_name);
            
            // utterance of ModifyTherapyIntentHandlerReminderIntent
        }
        // if all therapies 'new' and 'updated' are set up, inizialize count and exit from the intent
        else if(count_new_therapies >= new_therapies.length && count_updated_therapies >= updated_therapies.length){
          
            count_new_therapies = 0;
            count_updated_therapies = 0;
            sessionAttributes['count_new_therapies'] = count_new_therapies;
            sessionAttributes['count_updated_therapies'] = count_updated_therapies;
            const timezone = "Europe/Rome";
            let startDate = logic.convertDateForDatabase(moment().tz(timezone).subtract(7, 'days')); // bisogna farlo iniziare prima del giorno stesso
            let endDate = logic.convertDateForDatabase(moment().tz(timezone).add(4, 'months')); 
            let therapiesChecked= await logic.getTherapies(access_token,startDate,endDate); 
            sessionAttributes['all_therapies'] = therapiesChecked.all_therapies;
            console.log('th '+JSON.stringify(therapiesChecked.all_therapies))
        
            const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
            speakOutput=requestAttributes.t('REMINDERS_COMPLETED_MSG');
                return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt()
            .getResponse();
          
            
        }
    
      
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt()
            .getResponse();
    }

       
};

const CreateTherapyIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'CreateTherapyIntent';
    },
    async handle(handlerInput) {
        console.log('in CreateTherapyIntent')
        const reminderApiClient = handlerInput.serviceClientFactory.getReminderManagementServiceClient();
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        let count_new_therapies = sessionAttributes['count_new_therapies'];
        
        // get new_therapies that have therapy.edit='new' e therapy.state = true
        let new_therapies = sessionAttributes['new_therapies'];

        // get reminders_ids w/ all objects reminders_id
        let reminders_ids = sessionAttributes['reminders'];
        
        if (!reminders_ids) {
            reminders_ids = [];
        }

        if(reminders_ids.length===0){
            reminders_ids = [];
        }
        
        // select a therapy
        let therapy = await new_therapies[count_new_therapies];
        
        let last_intake_time = logic.getLastIntakeTime(therapy);

        
        // create the body for the reminders to create through logic.setTherapy
        let reminderBody = await logic.setTherapy(therapy);
     
        // creazione del reminders e alert
        
        for (let i=0; i < reminderBody.remindersAlert.length; i++)  {
            
            
            let reminderAlertResponse = await reminderApiClient.createReminder(reminderBody.remindersAlert[i]);
            
             
            let reminderConfirmationResponse = await reminderApiClient.createReminder(reminderBody.remindersConfirmation[i]);  
           
            // salvataggio alert token
            let reminderAlertToken = await reminderAlertResponse.alertToken;
            let reminderConfirmationToken = await reminderConfirmationResponse.alertToken;
            
            let reminder_id = {
                    "therapy_id": therapy._id,
                    "alertToken" : reminderAlertToken,
                    "confirmationToken" : reminderConfirmationToken,
                    "last_intake_time" : last_intake_time,
                    
                }
            reminders_ids.push(reminder_id);
        }

        sessionAttributes['reminders'] = reminders_ids;
     
        //modifico nel DB il campo therapy.edit in 'saved'
        let access_token = sessionAttributes['access_token'];
        
        let response = await logic.patchTherapy(access_token, therapy._id, "saved");
        
        count_new_therapies ++;
        
       
        
        
        sessionAttributes['count_new_therapies'] = count_new_therapies;
      
        return SayTherapyIntentHandler.handle(handlerInput);
    }
};

const ModifyTherapyIntentHandler = {
    
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'ModifyTherapyIntent';
    },
    async handle(handlerInput) {
        console.log('in ModifyTherapyIntent')
        const reminderApiClient = handlerInput.serviceClientFactory.getReminderManagementServiceClient();
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        
        let speakOutput;
        let count_updated_therapies = sessionAttributes['count_updated_therapies'];
        let updated_therapies = sessionAttributes['updated_therapies'];
        let reminders_ids = sessionAttributes['reminders'];
        
        if (!reminders_ids) {
            reminders_ids = [];
        }
        if(reminders_ids.length===0){
            reminders_ids = [];
        }
        
        let therapy = await updated_therapies[count_updated_therapies];
        
        let last_intake_time = logic.getLastIntakeTime(therapy);

        // trovo l'oggetto reminder che ha therapy_id 
        let therapy_todelete = reminders_ids.filter(reminder_id => reminder_id.therapy_id === therapy._id);
        
        //controllo se esiste
        let remindersList = await reminderApiClient.getReminders();
        let aT;
        
        if (remindersList.alerts.length > 0){
          
            
            for (let d=0; d<remindersList.alerts.length; d++){
                
                aT= remindersList.alerts[d].alertToken;
            
                if (therapy_todelete.length > 0){
                    if (aT === therapy_todelete[0].alertToken){
                        await reminderApiClient.deleteReminder(therapy_todelete[0].alertToken);
                        await reminderApiClient.deleteReminder(therapy_todelete[0].confirmationToken);
                    }
                }
            }
        
        }
        
        
        // risalvo in sessione i reminders rimanenti (rimuovendo quello eliminato)
        let reminders_ids_left = reminders_ids.filter(reminder_id => reminder_id.therapy_id !== therapy._id);
        sessionAttributes['reminders'] = reminders_ids_left;
       
        // se il therapy.state è true vuol dire che la terapia è ancora attiva quindi andiamo a reimpostare reminders con dati aggiornati
      
         if (therapy.state === true){
            let reminderBody = await logic.setTherapy(therapy);
            
            let reminders_ids = sessionAttributes['reminders'];
        
            for (let i=0; i < reminderBody.remindersAlert.length; i++)  {
                 
                
                let reminderAlertResponse = await reminderApiClient.createReminder(reminderBody.remindersAlert[i]);
                let reminderConfirmationResponse = await reminderApiClient.createReminder(reminderBody.remindersConfirmation[i]);  
           
                //salvataggio alert token dei reminders apppena creati
                 let reminderAlertToken = await reminderAlertResponse.alertToken;
                 let reminderConfirmationToken = await reminderConfirmationResponse.alertToken;
                //aggiungo l'oggetto nell'array reminders_ids
                let reminder_id = {
                        "therapy_id": therapy._id, // controlla che sia 'id' il nome del campo
                        "alertToken" : reminderAlertToken,
                        "confirmationToken" : reminderConfirmationToken,
                        "last_intake_time" : last_intake_time
                    }
                
                reminders_ids.push(reminder_id);
            }
            sessionAttributes['reminders'] = reminders_ids;
        }
     
        
        // modifico nel DB il campo 'edit' in 'saved'
        let access_token = sessionAttributes['access_token'];
        
 
          
        if (therapy.edit === 'updated'){
            let response = await logic.patchTherapy(access_token, therapy._id, "saved"); 
        }
        else if (therapy.edit === 'todelete'){
            let response = await logic.patchTherapy(access_token, therapy._id, "deleted"); 
        }
        
        count_updated_therapies ++;
        
        sessionAttributes['count_updated_therapies'] = count_updated_therapies;
        
        return SayTherapyIntentHandler.handle(handlerInput);
     
            
    }
};





const WhichMedicineTodayIntent = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'WhichMedicineTodayIntent';
    },
    async handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
      console.log('in WhichMedicineTodayIntent')
        
        sessionAttributes['signed_medicine_MSG'] = ` `;
        let access_token = sessionAttributes['access_token'];

      
    if ( sessionAttributes['flag_therapies']===1){
       
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
        const speakOutput=requestAttributes.t('CHECK_THERAPIES_MSG');
            
            return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt()
            .getResponse();
            
    }
 
    let list_therapies = sessionAttributes['all_therapies'];
    
            let intakes_all =[];
            for (let t=0; t < list_therapies.length; t++)  {
                intakes_all= intakes_all.concat(list_therapies[t].intakes);
            }
            
            
          // avrei dovuto mettere come filtro missed o programmed ma è capitato che fosse programmed ma doveva essere missed
             const timezone = "Europe/Rome";
            const currentTime = moment().tz(timezone);
            let today = currentTime; 
       
            let list_programmed_intakes = intakes_all.filter(intake => logic.convertDateFromDatabase(intake.programmed_date).format('l')=== today.format('l'));
           
          
        
           let list_today_old_intakes = list_programmed_intakes.filter(intake => logic.convertDateFromDatabase(intake.programmed_date).isSameOrBefore(today,'hour'))
            list_programmed_intakes = list_programmed_intakes.filter(intake => logic.convertDateFromDatabase(intake.programmed_date).isSameOrAfter(today,'hour'))
            
            
           //list_programmed_intakes = list_programmed_intakes.filter(intake => (logic.convertDateFromDatabase(intake.programmed_date).format('LT')).isSameOrBefore(today.format('LT')))
             
      
            
        let speakOutput;
        if (list_programmed_intakes.length===0){
          
             const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
             speakOutput=requestAttributes.t('NO_MEDICINE_MSG');
        }else{
        speakOutput=list_programmed_intakes[0].drug.split("-")[0];
        speakOutput= speakOutput.concat(' alle ');
        speakOutput= speakOutput.concat(logic.convertDateFromDatabase(list_programmed_intakes[0].programmed_date).format('LT'), ' ');
         for (let t=1; t < list_programmed_intakes.length; t++)  { // 
                
               
                speakOutput= speakOutput.concat(' e ')
                
                
                speakOutput= speakOutput.concat(list_programmed_intakes[t].drug.split("-")[0], ' alle ');
                
                speakOutput= speakOutput.concat(logic.convertDateFromDatabase(list_programmed_intakes[t].programmed_date).format('LT'), ' ');
               
                
            }
        }
       
          if (list_today_old_intakes.length!==0){ 
            speakOutput= speakOutput.concat('poi dovresti avere già preso ');
               for (let t=0; t < list_today_old_intakes.length; t++)  {
                speakOutput= speakOutput.concat(list_today_old_intakes[t].drug.split("-")[0], ' alle ');
                speakOutput= speakOutput.concat(logic.convertDateFromDatabase(list_today_old_intakes[t].programmed_date).format('LT'), ' ');
                 if (list_programmed_intakes.length< t-1){
                    speakOutput= speakOutput.concat(' e ')
                }
            }
            
          }
             
       speakOutput= speakOutput.concat('. Se vuoi controllare quali farmaci hai confermato di aver preso dimmi: ho dimenticato dei farmaci?  ')
        // Post logs
        let typeOfAccess = 'WhichMedicineTodayIntent';
        let logResponse = await logic.postLogs(access_token, typeOfAccess);
       
        
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt()
            .getResponse();
        
    }
};











const ConfirmIntakeIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'ConfirmIntakeIntent';
    },
    async handle(handlerInput) {
        console.log('in ConfirmIntakeIntent')
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        let count_intakes = 0;
        sessionAttributes['count_intakes'] = count_intakes;
        sessionAttributes['signed_medicine_MSG'] = ` `;
        let access_token = sessionAttributes['access_token'];
       

         const timezone = "Europe/Rome";
         
    if ( sessionAttributes['flag_therapies']===1){
       
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
        const speakOutput=requestAttributes.t('CHECK_THERAPIES_MSG');
            
            return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt()
            .getResponse();
            
    }
    
        // Post logs
        let typeOfAccess = 'Confirm Intake Intent';
        let logResponse = await logic.postLogs(access_token, typeOfAccess);
       
       
           
           
           
     
        
        
           
        return WhichMedicineIntentHandler.handle(handlerInput); 
    }
};

const WhichMedicineIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'WhichMedicineIntent';
    },
   
   async handle(handlerInput) {
       console.log('in WhichMedicineIntent')
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        let count_intakes = sessionAttributes['count_intakes'];
        let list_interval_intakes =[];
        let speakOutput
       
        if (!count_intakes){
            count_intakes = 0;
            sessionAttributes['count_intakes'] = count_intakes;
        }
        if(count_intakes===0){
            let list_therapies = sessionAttributes['all_therapies'];
           
            let intakes_all =[];
            for (let t=0; t < list_therapies.length; t++)  {
                intakes_all= intakes_all.concat(list_therapies[t].intakes);
            }
            
            let list_programmed_intakes = intakes_all.filter(intake => intake.status === 'programmed');
        
            // creazione dell'attributo che tiene in memoria quando il paziente dice di aver preso le medicine, ogni tot cambia messaggio al prossimo reminder
            // aggiungere attributo al file constants. il counter incrementa a yes intent o no intent?
            
            
          
            //prendiamo gli intakes compresi nell'intervallo di tempo t precedente alla richiesta
            const timezone = "Europe/Rome"; 
            const currentTime = moment().tz(timezone);
       
            let min
            let max
            let intake
            for (let t=0; t < list_programmed_intakes.length; t++)  {
                let temp= Math.floor((list_programmed_intakes[t].max_delay)/2);
                 min = moment(currentTime).tz(timezone).startOf('minute').subtract(temp, 'minutes'); //modificare in base a max_delay
                 max = moment(currentTime).tz(timezone).startOf('minute').add(temp, 'minutes');
                
                 intake=list_programmed_intakes[t];
               
                 if( moment(logic.convertDateFromDatabase(intake.programmed_date)).isSameOrAfter(min) && moment(logic.convertDateFromDatabase(intake.programmed_date)).isSameOrBefore(max) )
                 {
                  list_interval_intakes.push(intake)
                     
                 }
                
            }
 
            sessionAttributes['list_interval_intakes'] = list_interval_intakes;
          
        }else{
            list_interval_intakes=sessionAttributes['list_interval_intakes']
            
        }
       
        
       
        if(list_interval_intakes.length === 0){
            
            
            const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
            const speakOutput=requestAttributes.t('MEDICINE_OVER_MSG');
            return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt()
            .getResponse();
        }
        
       
        
        
        
        
        let medicine_name  = list_interval_intakes[count_intakes].drug.split("-")[0];
        let medicine_posology = list_interval_intakes[count_intakes].posology;
        
        let signed_medicine_MSG = sessionAttributes['signed_medicine_MSG'];
        
        
        
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
         speakOutput=requestAttributes.t('TAKEN_CONFIRMATION_MSG',signed_medicine_MSG,medicine_posology,medicine_name);
        
        sessionAttributes['signed_medicine_MSG'] = ` `;
        
      
         
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt()
            .getResponse();
     
  

       
   }
};

const YesIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.YesIntent';
    },
    async handle(handlerInput) {
        
        
       console.log('in yes')
        let locale= "it-IT"
        let speakOutput
         
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const reminderApiClient = handlerInput.serviceClientFactory.getReminderManagementServiceClient();
       
       console.log('riga 701')
        let count_intakes = sessionAttributes['count_intakes'];
        let list_interval_intakes = sessionAttributes['list_interval_intakes'];
        let access_token = sessionAttributes['access_token'];
console.log('riga 705')
        
     
        //Gestire invio intake al DB (modifica del campo status in 'taken' e invio del campo intake_delay) 
        let intake_id = list_interval_intakes[count_intakes]._id;
         
        
        let time_intake = logic.convertDateFromDatabase(list_interval_intakes[count_intakes].programmed_date);
        let status = "taken";
        const timezone = "Europe/Rome";
        let currentTime = moment().tz(timezone);
        let delay = moment.duration(currentTime.diff(time_intake, 'minutes'));
        let intake_delay = Number(delay);
    
        console.log('riga 719') 
        // salvo il therapy id specifico di cui stiamo parlando, tramite il count_intakes
        let intervalTherapy_id = list_interval_intakes[count_intakes].therapy_id;
         console.log('int id '+ intervalTherapy_id)
         console.log('list in ' + JSON.stringify(list_interval_intakes))
         console.log('count ' + count_intakes)
         sessionAttributes['last_intake'] = list_interval_intakes[count_intakes];
       
        // filtro oggetti reminders che hanno therapy_id uguale a quello appena salvato 
        let reminders = sessionAttributes['reminders'];   
       
       
 console.log('riga 728')
      console.log('rem ' + sessionAttributes['reminders'])
      console.log(intervalTherapy_id)
       let reminder_idToUpdate = reminders.filter(reminders => reminders.therapy_id === intervalTherapy_id);
       console.log(reminder_idToUpdate)
       console.log(intake_delay)
           if (intake_delay<0){
               
        let reminderToUpdate=reminder_idToUpdate[0].alertToken;
        console.log(reminderToUpdate)
        let ReminderConfirmation = await reminderApiClient.getReminder(reminderToUpdate);
        console.log(ReminderConfirmation)
        
        
        let newTimeA = ReminderConfirmation.trigger.recurrence.startDateTime;
        console.log(newTimeA)  
        newTimeA= moment(newTimeA).tz(timezone).add(1,"days");//;
        //newTime=newTime.format('YYYY-MM-DDTHH');
                 
        //modifico il body sostituendo la startDateTime
       
        let updatedReminderA =  ReminderConfirmation;
    console.log(updatedReminderA)        
             console.log('riga 748')
        updatedReminderA.trigger.recurrence.startDateTime = newTimeA;
    
   
    const alertTokenA =reminderToUpdate
   await reminderApiClient.deleteReminder(alertTokenA)  
    
    
    let endA = ReminderConfirmation.trigger.recurrence.endDateTime;
    
    
     let recurrenceRulesUpdatedA=ReminderConfirmation.trigger.recurrence.recurrenceRules

     let textUpdatedA=ReminderConfirmation.alertInfo.spokenInfo.content[0].text;
  
    
   let new_upA=logic.convertDateFromDatabase(newTimeA)
   let end_upA=logic.convertDateFromDatabase(endA)
   
         if (moment(newTimeA).tz(timezone).isSameOrBefore(moment(endA).tz(timezone)))   {
    
   let  bodyA=util.UpdateReminderBody(new_upA, end_upA, timezone, locale,textUpdatedA,recurrenceRulesUpdatedA)
 
            console.log('riga 771')
   let updatedRemA = await reminderApiClient.createReminder(bodyA);
  
   let reminderAlertTokenA = await updatedRemA.alertToken;
   let reminders_ids_leftA = reminders.filter(reminders => reminders.alertToken !== reminder_idToUpdate);
   let reminders_newA = reminders.filter(reminders => reminders.alertTokenToken === reminder_idToUpdate)
   reminders_newA.alertToken = reminderAlertTokenA; 
   reminders_ids_leftA.push(reminders_newA);      
   sessionAttributes['reminders'] = reminders_ids_leftA;

}   
        
    }
    
    
    console.log('riga 788')
     if (intake_delay < ((list_interval_intakes[count_intakes].max_delay/2)-5)){
    console.log('riga 790')
     reminder_idToUpdate = reminders.filter(reminders => reminders.therapy_id === intervalTherapy_id);
    console.log('riga 792')
        // eliminare anche quello non confirmation se l'orario è prima che suoni
       
        let confirmationTokenToUpdate = reminder_idToUpdate[0].confirmationToken;
       console.log('riga 796')
       
       let oldReminderConfirmation = await reminderApiClient.getReminder(confirmationTokenToUpdate);
          
              console.log('riga 798')

        let newTime = oldReminderConfirmation.trigger.recurrence.startDateTime;
      
        newTime= moment(newTime).tz(timezone).add(1,"days");//;
        //newTime=newTime.format('YYYY-MM-DDTHH');
                 
        //modifico il body sostituendo la startDateTime
        
        let updatedReminder =  oldReminderConfirmation;
        
        updatedReminder.trigger.recurrence.startDateTime = newTime;

   
    const alertToken = confirmationTokenToUpdate;
   await reminderApiClient.deleteReminder(alertToken)  
    
    
    let end = oldReminderConfirmation.trigger.recurrence.endDateTime;
 
    
     let recurrenceRulesUpdated=oldReminderConfirmation.trigger.recurrence.recurrenceRules

     let textUpdated=oldReminderConfirmation.alertInfo.spokenInfo.content[0].text;

    
   let new_up=logic.convertDateFromDatabase(newTime)
   let end_up=logic.convertDateFromDatabase(end)
   
         if (moment(newTime).tz(timezone).isSameOrBefore(moment(end).tz(timezone)))   {
    
   let  body=util.UpdateReminderBody(new_up, end_up, timezone, locale,textUpdated,recurrenceRulesUpdated)
 
        
   let updatedRem = await reminderApiClient.createReminder(body);
  
   let reminderAlertToken = await updatedRem.alertToken;
   let reminders_ids_left = reminders.filter(reminders => reminders.confirmationToken !== reminder_idToUpdate);
   let reminders_new = reminders.filter(reminders => reminders.confirmationToken === reminder_idToUpdate)
   reminders_new.confirmationToken = reminderAlertToken; 
   reminders_ids_left.push(reminders_new);      
   sessionAttributes['reminders'] = reminders_ids_left;

}       
     }         

       
        console.log('riga 845')
        
        // Post logs
        let typeOfAccess = 'Yes Intent';
        let logResponse = await logic.postLogs(access_token, typeOfAccess);
        console.log('logresponse   ' + logResponse)
        //modifica all_therapies da sessione 
        let list_therapies = sessionAttributes['all_therapies'];
        let medicineIndex = list_therapies.findIndex(medicine => medicine._id === intervalTherapy_id);

        let intakeIndex = list_therapies[medicineIndex].intakes.findIndex(intake => intake._id === intake_id);

        list_therapies[medicineIndex].intakes[intakeIndex].status = status;
        sessionAttributes['all_therapies'] = list_therapies;
        

        
        count_intakes++;
        sessionAttributes['count_intakes'] = count_intakes;
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
        sessionAttributes['signed_medicine_MSG'] =requestAttributes.t('TAKEN_CONFIRMATION_ANS_MSG');
        let response = await logic.patchIntake(access_token, intake_id, status, intake_delay);
        
        
        
            if( count_intakes === list_interval_intakes.length) {
            count_intakes = 0;
            sessionAttributes['count_intakes'] = count_intakes;
            
            
            
            
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
        const speakOutput=requestAttributes.t('TAKEN_CONFIRMATION_ANS_LAST_MSG');
      
            sessionAttributes['list_interval_intakes'] = [];
            return handlerInput.responseBuilder
                .speak(speakOutput)
                //.reprompt()
                .getResponse();
        }
       
        return WhichMedicineIntentHandler.handle(handlerInput) 
        
      
    }
  
};

const NoIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.NoIntent';
    },
    handle(handlerInput) {
        console.log('in NoIntent')
         const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
         
        let count_intakes = sessionAttributes['count_intakes'];
        
            if ( sessionAttributes['flag_therapies']===1){
       
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
        const speakOutput=requestAttributes.t('CHECK_THERAPIES_MSG');
            
            return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt()
            .getResponse();
            
    }
        
        
        
        let list_interval_intakes = sessionAttributes['list_interval_intakes'];
         
        
        
        if( count_intakes >= list_interval_intakes.length-1) {
            count_intakes = 0;
            sessionAttributes['count_intakes'] = count_intakes;
            
            const speakOutput =requestAttributes.t('TAKEN_CONFIRMATION_ANS_NO_LAST_MSG')
            sessionAttributes['list_interval_intakes'] = [];
            return handlerInput.responseBuilder
                .speak(speakOutput)
                //.reprompt()
                .getResponse();
        }
        count_intakes ++;
        
        sessionAttributes['count_intakes'] = count_intakes;
        sessionAttributes['signed_medicine_MSG'] = requestAttributes.t('TAKEN_CONFIRMATION_ANS_NO_MSG');
        
        return WhichMedicineIntentHandler.handle(handlerInput);
    }
};

const LastIntakeIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'LastIntakeIntent';
    },
    handle(handlerInput) {
         const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        let therapy=sessionAttributes['last_intake']
        
            if ( sessionAttributes['flag_therapies']===1){
       
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
        const speakOutput=requestAttributes.t('CHECK_THERAPIES_MSG');
            
            return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt()
            .getResponse();
            
    }
        
        let drugname_w = therapy.drug.split("-")[0];
        let posology_w = therapy.posology;
        let timezone="Europe/Rome";
        let date_w = logic.convertDateFromDatabase(therapy.programmed_date)    
          
         date_w=date_w.format('LT')
        
        const speakOutput=requestAttributes.t('LAST_INTAKE_MSG',posology_w,drugname_w,date_w);
       
        return handlerInput.responseBuilder
            .speak(speakOutput)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
   
    }
};

const RequestMissedIntakesIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'RequestMissedIntakesIntent';
    },
   async handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
      
        
        sessionAttributes['signed_medicine_MSG'] = ` `;
        let access_token = sessionAttributes['access_token'];

      
    if ( sessionAttributes['flag_therapies']===1){
       
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
        const speakOutput=requestAttributes.t('CHECK_THERAPIES_MSG');
            
            return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt()
            .getResponse();
            
    }
 
    let list_therapies = sessionAttributes['all_therapies'];
    
            let intakes_all =[];
            for (let t=0; t < list_therapies.length; t++)  {
                intakes_all= intakes_all.concat(list_therapies[t].intakes);
            }
            
            
          // avrei dovuto mettere come filtro missed o programmed ma è capitato che fosse programmed ma doveva essere missed
             const timezone = "Europe/Rome";
            const currentTime = moment().tz(timezone);
            let today = currentTime; 
       
            let list_missed_intakes = intakes_all.filter(intake => logic.convertDateFromDatabase(intake.programmed_date).format('l')=== today.format('l'));
          list_missed_intakes = list_missed_intakes.filter(intake => intake.status === 'missed');
   
            
           //list_programmed_intakes = list_programmed_intakes.filter(intake => (logic.convertDateFromDatabase(intake.programmed_date).format('LT')).isSameOrBefore(today.format('LT')))
             
      
        let speakOutput;
        if (list_missed_intakes.length===0){
          
             const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
                const speakOutput=requestAttributes.t('ALL_TAKEN_MSG');
        }else{
        speakOutput=list_missed_intakes[0].drug.split("-")[0];
        speakOutput= speakOutput.concat(' alle ');
        speakOutput= speakOutput.concat(logic.convertDateFromDatabase(list_missed_intakes[0].programmed_date).format('LT'), ' ');
         for (let t=1; t < list_missed_intakes.length; t++)  { // 
                
               
                speakOutput= speakOutput.concat(' e ')
                
                
                speakOutput= speakOutput.concat(list_missed_intakes[t].drug.split("-")[0], ' alle ');
                
                speakOutput= speakOutput.concat(logic.convertDateFromDatabase(list_missed_intakes[t].programmed_date).format('LT'), ' ');
               
                
            }
        }
       
             
      
        // Post logs
        let typeOfAccess = 'WhichMedicineTodayIntent';
        let logResponse = await logic.postLogs(access_token, typeOfAccess);
        console.log(logResponse)
        
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt()
            .getResponse();
        
    }
};

const RequestAdherenceIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'RequestAdherenceIntent';
    },
    async handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        let access_token = sessionAttributes['access_token'];
        console.log('in RequestAdherenceIntent')
            if ( sessionAttributes['flag_therapies']===1){
       
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
        const speakOutput=requestAttributes.t('CHECK_THERAPIES_MSG');
            
            return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt()
            .getResponse();
            
    }
   
        let speakOutput
        const dataForAdherence = await logic.getTherapiesForAdherence(access_token);
            
            console.log(JSON.stringify(dataForAdherence))
        let adherence = dataForAdherence.adherence;
         
             const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
     
        // TENGO?
        if (adherence < 30) {
            adherence=adherence.toString();
           
            speakOutput=requestAttributes.t('LOW_ADHERENCE',adherence);
        }
        else if (adherence < 80) {
            adherence=adherence.toString();
           
             speakOutput=requestAttributes.t('MID_ADHERENCE',adherence);
           
         }
        else if (adherence >= 80) {
             adherence=adherence.toString();
                speakOutput=requestAttributes.t('HIGH_ADHERENCE',adherence);
             }
        else {
            adherence=adherence.toString();
           
             speakOutput=requestAttributes.t('ERROR_ADHERENCE');
            
        }

        // Post logs
        let typeOfAccess = 'Request Adherence Intent';
        let logResponse = await logic.postLogs(access_token, typeOfAccess);
        console.log(speakOutput)
        return handlerInput.responseBuilder
            .speak(speakOutput)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
    }
};
// ALEXA CHIEDI A MEDICO VIRTUALE DI CANCELLARE TUTTI I DATI IN SESSIONE
const DeleteDataSessionIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'DeleteDataSessionIntent';
    },
    handle(handlerInput) {

        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        delete sessionAttributes['access_token'];
        delete sessionAttributes['name'];
        delete sessionAttributes['reminders'];
        delete sessionAttributes['list_interval_intakes'];
        delete sessionAttributes['count_intakes'];
        delete sessionAttributes['signed_medicine_MSG'];
        delete sessionAttributes['all_therapies'];
        //delete sessionAttributes['edit_therapies'];
        delete sessionAttributes['new_therapies'];
        delete sessionAttributes['updated_therapies'];
        delete sessionAttributes['count_new_therapies'];
        delete sessionAttributes['count_updated_therapies'];
        delete sessionAttributes['therapies'];
        
        const speakOutput = 'Ho eliminato TUTTI i dati in sessione!';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
    }
};
const HelpUserIntentHandler = {
   canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'HelpUserIntent';
    },
    handle(handlerInput, error) {
        const speakOutput = 'Ciao, puoi chiedermi: Alexa, apri medico virtuale, per controllare e impostare le tue terapie, oppure Alexa, chiedi a medico virtuale di segnarsi le medicine, \
        dopo che hai preso le medicine, oppure Alexa, quali medicine devo prendere oggi, per sapere che medicine devi prendere ,oppure Alexa, chiedi a medico virtuale se ho dimenticato di dei farmaci, per sapere se hai dimenticato delle medicine, \
        oppure alexa, qual è la mia aderenza, per sapere la tua percentuale di aderenza alle terapie,oppure, alexa chiedi a medico virtuale qual è l ultima medicina che ho preso \
        per sapere qual è l ultima medicina che hai preso, oppure alexa, cancella tutti i dati in sessione, per eliminare tutti \
        i tuoi dati su alexa';
     

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'Ciao, come posso aiutarti?';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const speakOutput = 'Ciao, alla prossima!';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};
/* *
 * FallbackIntent triggers when a customer says something that doesn’t map to any intents in your skill
 * It must also be defined in the language model (if the locale supports it)
 * This handler can be safely added but will be ingnored in locales that do not support it yet 
 * */
const FallbackIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'Sorry, I don\'t know about that. Please try again.';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};
/* *
 * SessionEndedRequest notifies that a session was ended. This handler will be triggered when a currently open 
 * session is closed for one of the following reasons: 1) The user says "exit" or "quit". 2) The user does not 
 * respond or says something that does not match an intent defined in your voice model. 3) An error occurs 
 * */
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log(`~~~~ Session ended: ${JSON.stringify(handlerInput.requestEnvelope)}`);
        // Any cleanup logic goes here.
        return handlerInput.responseBuilder.getResponse(); // notice we send an empty response
    }
};
/* *
 * The intent reflector is used for interaction model testing and debugging.
 * It will simply repeat the intent the user said. You can create custom handlers for your intents 
 * by defining them above, then also adding them to the request handler chain below 
 * */
const IntentReflectorHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest';
    },
    handle(handlerInput) {
        const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
        const speechText = `You just triggered ${intentName}`;

        return handlerInput.responseBuilder
            .speak(speechText)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
    }
};
/**
 * Generic error handling to capture any syntax or routing errors. If you receive an error
 * stating the request handler chain is not found, you have not implemented a handler for
 * the intent being invoked or included it in the skill builder below 
 * */
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        const speakOutput = 'Scusa, ho avuto un problema nella risposta alla tua richiesta.';
        console.log(`~~~~ Error handled: ${JSON.stringify(error)}`);

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

/**
 * This handler acts as the entry point for your skill, routing all request and response
 * payloads to the handlers above. Make sure any new handlers or interceptors you've
 * defined are included below. The order matters - they're processed top to bottom 
 * */
exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        SecurityCodeIntentHandler,
        LoadTherapiesIntentHandler,
        SayTherapyIntentHandler,
        CreateTherapyIntentHandler,
        ModifyTherapyIntentHandler,
        WhichMedicineTodayIntent,
        ConfirmIntakeIntentHandler,
        WhichMedicineIntentHandler,
        YesIntentHandler,
        NoIntentHandler,
        LastIntakeIntentHandler,
        RequestMissedIntakesIntentHandler,
        RequestAdherenceIntentHandler,
        DeleteDataSessionIntentHandler,
        HelpUserIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        FallbackIntentHandler,
        SessionEndedRequestHandler,
        IntentReflectorHandler)
    .addErrorHandlers(
        ErrorHandler)
    .addRequestInterceptors(
        interceptors.LoadAttributesRequestInterceptor,
        interceptors.LocalisationRequestInterceptor,interceptors.CheckTherapiesRequestInterceptor)
    .addResponseInterceptors(
        interceptors.SaveAttributesResponseInterceptor,interceptors.PostIntentResponseInterceptor)//,
    .withPersistenceAdapter(util.getPersistenceAdapter())
    .withApiClient(new Alexa.DefaultApiClient())
    .withCustomUserAgent('sample/hello-world/v1.2')
    .lambda();