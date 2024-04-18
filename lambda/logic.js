
const axios = require('axios');
const util = require('./util'); // utility functions
const moment = require('moment-timezone'); // will help us do all the dates math while considering the timezone


module.exports = {

    async getAccessToken(Otp) {
        axios.default.timeout = 6500;
        console.log("otp logic: " + Otp )
        const res = await axios
            
            .post('https://intake-care-de7b20968242.herokuapp.com/auth/alexa/pair', {
            
                "otp": Otp
                // otp: Otp
            })
            .then(res =>{
                console.log("Pairing Successfull!")
                
                return res;
            })
            .catch((error) => {
                console.log("Pairing Failed.")
                console.log(error);
            });
        //console.log('res ' + JSON.stringify(res)) commentato perchè da errore di circolarità
        return res;
    },
  
    async getTherapies(access_token, start_date, end_date) {
        axios.default.timeout = 6500;
        const headers = {
            "Authorization": 'Bearer ' + access_token,
        }
        const params = {
            "start": start_date,
            "end": end_date
        }
        
        const res = await axios
            .get('https://intake-care-de7b20968242.herokuapp.com/intakes',
          
            {
                "headers": headers,
                "params": params
            })
            .then(res =>{
                console.log(res);
                return res;
            })
            .catch((error) => {
                console.log(error);
            });
        let edit_therapies = res.data.filter(therapy => therapy.edit !== 'saved');
        let updated_therapies = res.data.filter(therapy => therapy.edit === 'updated' || therapy.edit === 'todelete');
        let new_therapies = res.data.filter(therapy => therapy.edit === 'new' && therapy.state === true);  
        let all_therapies=res.data
        let to_return1={all_therapies, edit_therapies,updated_therapies,new_therapies };
      
        return to_return1;
    },
    
    async getTherapiesForAdherence(access_token) {
        axios.default.timeout = 6500;
        const headers = {
            "Authorization": 'Bearer ' + access_token,
        }
        const res = await axios
            .get('https://intake-care-de7b20968242.herokuapp.com/patients', {
           
                "headers": headers
            })
            .then(res =>{
                console.log(res);
                return res;
            })
            .catch((error) => {
                console.log(error);
            });
        
        return res.data;
       
    },
    
    async patchTherapy(access_token, id_therapy, edit) {
        axios.default.timeout = 6500;
        const headers = {
            "Authorization": 'Bearer ' + access_token,
        }
        const data = {
            "therapy":{"edit": edit}
        }
        console.log('data   '+ data)
        console.log('header   '+ headers)
        const res = await axios
          
            .patch(`https://intake-care-de7b20968242.herokuapp.com/therapies/${id_therapy}`, data,
            
            {
                "headers": headers
            })
            .then(res =>{
                console.log(res);
                return res;
            })
            .catch((error) => {
                console.log(error);
            });
        return res.data;
    },
    
    async patchIntake(access_token, id, status, intake_delay) {
        axios.default.timeout = 6500;
        const headers = {
            "Authorization": 'Bearer ' + access_token,
        }
        const data = {
            "status": status,
            "intake_delay": intake_delay
        }
        
        const res = await axios
            
            .patch(`https://intake-care-de7b20968242.herokuapp.com/intakes/${id}`, data,
           
            {
                "headers": headers
            })
            .then(res =>{
                console.log(res);
                return res;
            })
            .catch((error) => {
                console.log(error);
            });
        return res.data;
    },
    
    async postLogs(access_token, typeOfAccess) {
        axios.default.timeout = 6500;
        const headers = {
            "Authorization": 'Bearer ' + access_token,
        }
        const data = {
            "from": typeOfAccess
        }
        if (true){ // backend issue
            return "Logs NOT posted."
        }
        else {
        
        const res = await axios
          
            .post(`https://intake-care-de7b20968242.herokuapp.com/logs`, data,
            
            {
                "headers": headers
            })
            .then(res =>{
                console.log(res);
                return res;
            })
            .catch((error) => {
                console.log(error);
            });
        return res.data;
        }
    },
    
    convertDateFromDatabase(oldDate) {
        const timezone = "Europe/Rome";
        let year = moment(oldDate).year();
        let month = moment(oldDate).month(); // jan=0;
        let day = moment(oldDate).date();
        let hour = moment(oldDate).hour();
        let minute = moment(oldDate).minute();
        let second = moment(oldDate).second();
        let currentDate = moment().tz(timezone);
        let adjustedDate = moment(currentDate).set({'year': year, 'month': month, 'date': day, 'hour': hour, 'minute': minute, 'second': second });
        
        return adjustedDate;
    },
    
    convertDateForDatabase(oldDate) {
       // console.log('entro il convertDateForDatabase')
        let year = oldDate.year();
        let month = oldDate.month(); // jan=0;
        let day = oldDate.date();
        let hour = oldDate.hour();
        let minute = oldDate.minute();
        let second = oldDate.second();
        let adjustedDate = new Date(Date.UTC(year, month, day, hour, minute, second))
        console.log('adj '+ adjustedDate)
        return adjustedDate;
    },
    
    

    
    getLastIntakeTime(therapy){
    
     const timezone = "Europe/Rome";
        let end_date = moment(therapy.end_date).tz(timezone); // da cambiare
        
    
        let day_before = end_date.subtract(1,"days");
      
        
        let hour_max = 0;
        let minute_max = 0;
        
        for (let i=0; i < therapy.delivery.options.length; i++)  {
            
            let time_x = therapy.delivery.options[i].time.split(':');
            let hour_x = parseInt(time_x[0]);
            let minute_x = parseInt(time_x[1]);
         
            
            if (hour_x > hour_max){
                hour_max = hour_x;
                minute_max = minute_x;
            }
        }
   
        
        let last_intake_time = day_before.set({'hour':hour_max, 'minute':minute_max, 'second': 0 });
  
        return last_intake_time;
    },
    
    
    async setTherapy(therapy){
        
        const scheduling_type = therapy.delivery.scheduling_type;
        const timezone = "Europe/Rome";
        const locale = "it-IT";
        let remindersAlert =[];
        let remindersConfirmation =[];
        
    
        
    
        let drugname_w = therapy.drug.split("-")[0];
        let posology_w = therapy.posology;
        // meals String
        let meals_MSG_w = ``;
        let meals_w = therapy.meals;
        if(meals_w === "before"){
            meals_MSG_w = ' prima del pasto.'; // ANCHE IN LOGIC, IMMAGINO DI SI, FACCIO I18N?
        }
        else if(meals_w === "after"){
            meals_MSG_w = ' dopo il pasto.';
        }
        else if(meals_w === "during"){
            meals_MSG_w = ' durante il pasto.';
        }
        else{
            meals_MSG_w = ``;
        }
        let remindMedicineMSG_w = `è ora di prendere ${posology_w} di ${drugname_w}`+meals_MSG_w;
        let confirmMedicineMSG_w = `Ti ricordo che devi prendere ${posology_w} di ${drugname_w}`+meals_MSG_w;
        
        remindersAlert =[];
        remindersConfirmation =[];
        
        
        let start_date_w = moment(therapy.start_date).tz(timezone)                                  
                                               
    
      let end_date_w
    
     if (!therapy.end_date || !therapy.end_date===undefined) {
                    end_date_w =  moment(therapy.start_date).tz(timezone)   ; //default end date if not available 
                    end_date_w = end_date_w.add(3,'months')
                   
        }else{
             end_date_w = moment(therapy.end_date).tz(timezone)    
        }
     

        
     
        let max_delay_w = therapy.delivery.options[0].max_delay;
        if (!max_delay_w || max_delay_w===undefined) {
            max_delay_w = 120; //default max delay if not available
        }
        
        for (let i=0; i < therapy.delivery.options.length; i++)  {
            let cadence_w = therapy.delivery.options[i].cadence;
            let time_w = therapy.delivery.options[i].time.split(':');
            let hour_w = parseInt(time_w[0]);
            let minute_w = parseInt(time_w[1]);
            
            let minuteA1_w = minute_w + Math.floor(max_delay_w/2)-5;
            let hourA1_w = hour_w;
            if (minuteA1_w >= 60){
                let hours_to_add=Math.floor(minuteA1_w/60)
                minuteA1_w = Math.floor(minuteA1_w%60);
                hourA1_w = hour_w + hours_to_add;
            }
            const timezone = "Europe/Rome";
            const locale = "it-IT";
            //richiamo qui la funzione create reminder
            
            let reminderAlert_w = util.createReminder_w(start_date_w, end_date_w, hour_w, minute_w, cadence_w, timezone, locale, remindMedicineMSG_w);
            let reminderConfirmation_w = util.createReminder_w(start_date_w, end_date_w, hourA1_w, minuteA1_w, cadence_w, timezone, locale, confirmMedicineMSG_w);
         
      
            remindersAlert.push(reminderAlert_w);
            remindersConfirmation.push(reminderConfirmation_w);
           
        
      
                
         
        }
        return {remindersAlert, remindersConfirmation };  
    },
}
