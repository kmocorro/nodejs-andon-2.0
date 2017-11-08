$('document').ready(function()
{ 
    $('.yesFirst').hide();
    $('.noFirst').hide();

    $("#btn-survey").prop("disabled",true);

     $('.radioYes').on('click', function(){
        $('.yesFirst').show();
        $('.noFirst').hide();
        $("#btn-survey").prop("disabled",true);
    });

    $('.radioNo').on('click', function(){
        $('.yesFirst').hide();
        $('.noFirst').show();
    });



    $('#shuttleIn').on('click', function(){
        let shtIn = $('#shuttleIn option:selected').val();
        $('#shuttleOut').on('click', function(){
            let shtOut = $('#shuttleOut option:selected').val();
            
            if(shtIn !== 'default' && shtOut !== 'default'){
                $("#btn-survey").prop("disabled",false);
            }

        });
            
    });

    $('#whySelect').on('click', function(){
        let whyS = $('#whySelect option:selected').val();
        
        if(whyS !== 'default'){
            $("#btn-survey").prop("disabled",false);
        }

    });

    



    /* validation */
	 $("#survey_form").validate({
        rules:
        {
            shuttleIn: {
                required: true
            },
              
            shuttleOut: {
                required: true
            },
         },
         messages:
         {
              shuttleIn:{
                        required: "Please select your incoming route"
                       },
              shuttleOut: "Please select your outgoing route",
         },
         submitHandler: submitForm	
         });  

	   
	   /* survey submit */
	   function submitForm()
	   {		
			var data = $("#survey_form").serialize();
			
			$.ajax({
				
			type : 'POST',
			url  : '/survey/validate', // api url
			data : data,
			beforeSend: function()
			{	
                $("#error").fadeOut();
                
                $("#btn-survey").prop("disabled",true);
                
				$("#btn-survey").html('Saving ...');
			},
			success :  function(response)
			   {						
					if(response=="ok"){

						$("#btn-survey").html('Saving ...');
                        $("#btn-survey").prop("disabled",true);

						setTimeout(' window.location.href = "/thankyou"; ',500);
					}
					else{
									
						$("#error").fadeIn(1000, function(){						
							$("#error").html('<div class="alert alert-danger">'+response+' </div>');
							
                            $("#btn-survey").prop("disabled",false);
                            
						    setTimeout(' window.location.href = "/"; ',5000);
							
                        });
                        
                       /* $("#employee_id").click(function() {
                            $(this).closest('form').find("input[type=text], textarea").val("");
                        }); */
					}
			  }
			});
				return false;
		}
	   /* login submit */	  
	   
});